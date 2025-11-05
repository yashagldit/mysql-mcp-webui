import type Database from 'better-sqlite3';
import { getDatabase } from './schema.js';
import { generateToken, encryptPassword, decryptPassword } from '../config/crypto.js';
import { hashPassword } from '../config/auth-utils.js';
import type {
  ConnectionConfig,
  DatabaseConfig,
  Permissions,
  AddConnectionRequest,
  UpdateConnectionRequest
} from '../types/index.js';
import { defaultPermissions } from '../types/index.js';

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  created_at: number;
  last_used_at: number | null;
  is_active: boolean;
}

export interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: number;
  last_login_at: number | null;
  is_active: boolean;
  must_change_password: boolean;
}

export interface RequestLog {
  id: number;
  api_key_id: string | null;
  user_id: string | null;
  endpoint: string;
  method: string;
  request_body: string | null;
  response_body: string | null;
  status_code: number | null;
  duration_ms: number | null;
  timestamp: number;
}

export class DatabaseManager {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
    this.initializeDefaults();
  }

  /**
   * Execute a database operation with retry logic for SQLITE_BUSY errors
   * Uses exponential backoff: 10ms, 25ms, 50ms, 100ms, 200ms
   */
  private executeWithRetry<T>(fn: () => T, maxRetries: number = 5): T {
    let lastError: Error | null = null;
    const delays = [10, 25, 50, 100, 200];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return fn();
      } catch (error: any) {
        lastError = error;

        // Check if it's a SQLITE_BUSY error
        const isBusyError = error.code === 'SQLITE_BUSY' ||
                           error.message?.includes('SQLITE_BUSY') ||
                           error.message?.includes('database is locked');

        if (!isBusyError || attempt >= maxRetries) {
          // Not a busy error or max retries reached, throw immediately
          throw error;
        }

        // Log retry attempt
        const delay = delays[attempt] || 200;
        console.warn(`SQLite SQLITE_BUSY error, retry ${attempt + 1}/${maxRetries} after ${delay}ms`);

        // Wait before retrying (synchronous sleep)
        const start = Date.now();
        while (Date.now() - start < delay) {
          // Busy wait (not ideal but works for small delays)
        }
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError || new Error('Unknown error during retry');
  }

  /**
   * Initialize with default values (create first API key if none exist)
   * Uses atomic check-and-insert to prevent race conditions
   */
  private initializeDefaults(): void {
    const keys = this.getAllApiKeys();
    if (keys.length === 0) {
      // Use a fixed ID for the default key to prevent duplicates
      const defaultId = 'key_default_initial';
      const key = generateToken(64);
      const created_at = Date.now();

      try {
        this.executeWithRetry(() => {
          const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO api_keys (id, name, key, created_at, is_active)
            VALUES (?, ?, ?, ?, 1)
          `);
          stmt.run(defaultId, 'Default API Key', key, created_at);
        });

        // Check if we actually inserted the key (not ignored due to conflict)
        const inserted = this.getApiKey(defaultId);
        if (inserted && inserted.key === key) {
          console.error(`Created default API key: ${key}`);
        }
      } catch (error) {
        // If insert failed, another instance probably created it - that's OK
        console.error('Default API key creation skipped (already exists)');
      }
    }

    // Create default admin user if no users exist
    // Note: Password hashing is done lazily on first access to avoid blocking initialization
    if (!this.hasUsers()) {
      const defaultUserId = 'user_default_admin';
      // Store a flag to create admin user - actual creation happens async
      this.setSetting('needsAdminUser', 'true');
      console.error('No users found. Default admin user (username: admin, password: admin) will be created.');
      console.error('Please change the admin password after first login!');
    }

    // Migration: Set default connection if not set but connections exist
    const defaultConn = this.getSetting('defaultConnection');
    if (!defaultConn) {
      const connections = this.getAllConnections();
      if (connections.length > 0) {
        // Set the first connection (or active one) as default
        const activeConn = connections.find((c) => c.isActive) || connections[0];
        this.setSetting('defaultConnection', activeConn.id);
        console.error(`Migration: Set ${activeConn.name} as default connection`);
      }
    }
  }

  /**
   * Ensure default admin user exists (async, call after initialization)
   * Creates admin/admin user with must_change_password flag
   */
  async ensureDefaultAdminUser(): Promise<void> {
    const needsAdmin = this.getSetting('needsAdminUser');
    if (needsAdmin === 'true') {
      const defaultUserId = 'user_default_admin';

      try {
        // Check if admin already exists (race condition safety)
        const existing = this.getUserByUsername('admin');
        if (existing) {
          this.deleteSetting('needsAdminUser');
          return;
        }

        // Hash the default password
        const passwordHash = await hashPassword('admin');

        // Create admin user with atomic insert
        this.executeWithRetry(() => {
          const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO users (id, username, password_hash, created_at, is_active, must_change_password)
            VALUES (?, ?, ?, ?, 1, 1)
          `);
          stmt.run(defaultUserId, 'admin', passwordHash, Date.now());
        });

        // Verify insertion
        const inserted = this.getUserById(defaultUserId);
        if (inserted) {
          console.error('Created default admin user:');
          console.error('  Username: admin');
          console.error('  Password: admin');
          console.error('  ⚠️  You will be prompted to change this password on first login!');
        }

        this.deleteSetting('needsAdminUser');
      } catch (error) {
        console.error('Failed to create default admin user:', error);
      }
    }
  }

  // ============================================================================
  // API Key Management
  // ============================================================================

  /**
   * Create a new API key
   */
  createApiKey(name: string): ApiKey {
    const id = `key_${generateToken(12)}`;
    const key = generateToken(64);
    const created_at = Date.now();

    this.executeWithRetry(() => {
      const stmt = this.db.prepare(`
        INSERT INTO api_keys (id, name, key, created_at, is_active)
        VALUES (?, ?, ?, ?, 1)
      `);

      stmt.run(id, name, key, created_at);
    });

    return {
      id,
      name,
      key,
      created_at,
      last_used_at: null,
      is_active: true,
    };
  }

  /**
   * Get all API keys
   */
  getAllApiKeys(): ApiKey[] {
    const stmt = this.db.prepare(`
      SELECT id, name, key, created_at, last_used_at, is_active
      FROM api_keys
      ORDER BY created_at DESC
    `);

    return stmt.all().map((row: any) => ({
      ...row,
      is_active: Boolean(row.is_active),
    })) as ApiKey[];
  }

  /**
   * Get API key by ID
   */
  getApiKey(id: string): ApiKey | null {
    const stmt = this.db.prepare(`
      SELECT id, name, key, created_at, last_used_at, is_active
      FROM api_keys
      WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      ...row,
      is_active: Boolean(row.is_active),
    };
  }

  /**
   * Verify API key and return key info
   */
  verifyApiKey(key: string): ApiKey | null {
    const stmt = this.db.prepare(`
      SELECT id, name, key, created_at, last_used_at, is_active
      FROM api_keys
      WHERE key = ? AND is_active = 1
    `);

    const row = stmt.get(key) as any;
    if (!row) return null;

    // Update last_used_at
    this.updateApiKeyLastUsed(row.id);

    return {
      ...row,
      is_active: Boolean(row.is_active),
    };
  }

  /**
   * Update API key name
   */
  updateApiKeyName(id: string, name: string): void {
    this.executeWithRetry(() => {
      const stmt = this.db.prepare(`
        UPDATE api_keys
        SET name = ?
        WHERE id = ?
      `);

      stmt.run(name, id);
    });
  }

  /**
   * Update last_used_at timestamp
   */
  private updateApiKeyLastUsed(id: string): void {
    this.executeWithRetry(() => {
      const stmt = this.db.prepare(`
        UPDATE api_keys
        SET last_used_at = ?
        WHERE id = ?
      `);

      stmt.run(Date.now(), id);
    });
  }

  /**
   * Revoke (deactivate) API key
   */
  revokeApiKey(id: string): void {
    this.executeWithRetry(() => {
      const stmt = this.db.prepare(`
        UPDATE api_keys
        SET is_active = 0
        WHERE id = ?
      `);

      stmt.run(id);
    });
  }

  /**
   * Delete API key
   */
  deleteApiKey(id: string): void {
    this.executeWithRetry(() => {
      const stmt = this.db.prepare(`
        DELETE FROM api_keys
        WHERE id = ?
      `);

      stmt.run(id);
    });
  }

  // ============================================================================
  // User Management
  // ============================================================================

  /**
   * Create a new user
   */
  createUser(username: string, passwordHash: string, mustChangePassword: boolean = false): User {
    const id = `user_${generateToken(12)}`;
    const created_at = Date.now();

    this.executeWithRetry(() => {
      const stmt = this.db.prepare(`
        INSERT INTO users (id, username, password_hash, created_at, is_active, must_change_password)
        VALUES (?, ?, ?, ?, 1, ?)
      `);

      stmt.run(id, username, passwordHash, created_at, mustChangePassword ? 1 : 0);
    });

    return {
      id,
      username,
      password_hash: passwordHash,
      created_at,
      last_login_at: null,
      is_active: true,
      must_change_password: mustChangePassword,
    };
  }

  /**
   * Get all users (without password hashes in response)
   */
  getAllUsers(): Omit<User, 'password_hash'>[] {
    const stmt = this.db.prepare(`
      SELECT id, username, created_at, last_login_at, is_active, must_change_password
      FROM users
      ORDER BY created_at DESC
    `);

    return stmt.all().map((row: any) => ({
      ...row,
      is_active: Boolean(row.is_active),
      must_change_password: Boolean(row.must_change_password),
    })) as Omit<User, 'password_hash'>[];
  }

  /**
   * Get user by ID
   */
  getUserById(id: string): User | null {
    const stmt = this.db.prepare(`
      SELECT id, username, password_hash, created_at, last_login_at, is_active, must_change_password
      FROM users
      WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      ...row,
      is_active: Boolean(row.is_active),
      must_change_password: Boolean(row.must_change_password),
    };
  }

  /**
   * Get user by username
   */
  getUserByUsername(username: string): User | null {
    const stmt = this.db.prepare(`
      SELECT id, username, password_hash, created_at, last_login_at, is_active, must_change_password
      FROM users
      WHERE username = ?
    `);

    const row = stmt.get(username) as any;
    if (!row) return null;

    return {
      ...row,
      is_active: Boolean(row.is_active),
      must_change_password: Boolean(row.must_change_password),
    };
  }

  /**
   * Update user
   */
  updateUser(id: string, updates: { username?: string; is_active?: boolean; must_change_password?: boolean }): void {
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.username !== undefined) {
      updateFields.push('username = ?');
      params.push(updates.username);
    }
    if (updates.is_active !== undefined) {
      updateFields.push('is_active = ?');
      params.push(updates.is_active ? 1 : 0);
    }
    if (updates.must_change_password !== undefined) {
      updateFields.push('must_change_password = ?');
      params.push(updates.must_change_password ? 1 : 0);
    }

    if (updateFields.length === 0) return;

    params.push(id);

    this.executeWithRetry(() => {
      const stmt = this.db.prepare(`
        UPDATE users
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `);

      stmt.run(...params);
    });
  }

  /**
   * Update user password
   */
  updateUserPassword(id: string, passwordHash: string): void {
    this.executeWithRetry(() => {
      const stmt = this.db.prepare(`
        UPDATE users
        SET password_hash = ?, must_change_password = 0
        WHERE id = ?
      `);

      stmt.run(passwordHash, id);
    });
  }

  /**
   * Update user last login timestamp
   */
  updateUserLastLogin(id: string): void {
    this.executeWithRetry(() => {
      const stmt = this.db.prepare(`
        UPDATE users
        SET last_login_at = ?
        WHERE id = ?
      `);

      stmt.run(Date.now(), id);
    });
  }

  /**
   * Delete user
   */
  deleteUser(id: string): void {
    this.executeWithRetry(() => {
      const stmt = this.db.prepare(`
        DELETE FROM users
        WHERE id = ?
      `);

      stmt.run(id);
    });
  }

  /**
   * Check if any users exist
   */
  hasUsers(): boolean {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
    const result = stmt.get() as { count: number };
    return result.count > 0;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Add a new connection
   */
  addConnection(request: AddConnectionRequest, masterKey: string, autoDiscover: string[] = []): string {
    const id = `conn_${generateToken(12)}`;
    const encryptedPassword = encryptPassword(request.password, masterKey);
    const created_at = Date.now();

    // Check if this is the first connection
    const isFirst = this.db.prepare('SELECT COUNT(*) as count FROM connections').get() as { count: number };
    const is_active = isFirst.count === 0 ? 1 : 0;

    this.executeWithRetry(() => {
      const stmt = this.db.prepare(`
        INSERT INTO connections (id, name, host, port, user, password, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        request.name,
        request.host,
        request.port,
        request.user,
        JSON.stringify(encryptedPassword),
        is_active,
        created_at
      );
    });

    // Add discovered databases
    if (autoDiscover.length > 0) {
      this.addDatabases(id, autoDiscover, is_active === 1);
    }

    // If this is the first connection, set it as the default
    if (is_active) {
      this.setSetting('defaultConnection', id);
    }

    return id;
  }

  /**
   * Get all connections
   */
  getAllConnections(): ConnectionConfig[] {
    const stmt = this.db.prepare(`
      SELECT id, name, host, port, user, password, is_active, created_at
      FROM connections
      ORDER BY created_at DESC
    `);

    return stmt.all().map((row: any) => {
      const databases = this.getDatabasesByConnection(row.id);
      const activeDb = databases.find((db) => db.is_active);

      return {
        id: row.id,
        name: row.name,
        host: row.host,
        port: row.port,
        user: row.user,
        password: row.password,
        isActive: Boolean(row.is_active),
        databases: databases.reduce((acc, db) => {
          acc[db.name] = {
            name: db.name,
            permissions: this.dbRowToPermissions(db),
          };
          return acc;
        }, {} as Record<string, DatabaseConfig>),
        activeDatabase: activeDb?.name,
      };
    }) as ConnectionConfig[];
  }

  /**
   * Get connection by ID
   */
  getConnection(id: string): ConnectionConfig | null {
    const stmt = this.db.prepare(`
      SELECT id, name, host, port, user, password, is_active, created_at
      FROM connections
      WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    const databases = this.getDatabasesByConnection(id);
    const activeDb = databases.find((db) => db.is_active);

    return {
      id: row.id,
      name: row.name,
      host: row.host,
      port: row.port,
      user: row.user,
      password: row.password,
      isActive: Boolean(row.is_active),
      databases: databases.reduce((acc, db) => {
        acc[db.name] = {
          name: db.name,
          permissions: this.dbRowToPermissions(db),
        };
        return acc;
      }, {} as Record<string, DatabaseConfig>),
      activeDatabase: activeDb?.name,
    };
  }

  /**
   * Get active connection (deprecated - returns default connection)
   * @deprecated Use getDefaultConnectionId() instead
   */
  getActiveConnection(): ConnectionConfig | null {
    const defaultConnId = this.getDefaultConnectionId();
    if (!defaultConnId) {
      // Fallback: get first connection
      const stmt = this.db.prepare(`
        SELECT id FROM connections ORDER BY created_at ASC LIMIT 1
      `);
      const row = stmt.get() as { id: string } | undefined;
      if (!row) return null;
      return this.getConnection(row.id);
    }

    return this.getConnection(defaultConnId);
  }

  /**
   * Update connection
   */
  updateConnection(id: string, request: UpdateConnectionRequest, masterKey: string): void {
    const updates: string[] = [];
    const params: any[] = [];

    if (request.name !== undefined) {
      updates.push('name = ?');
      params.push(request.name);
    }
    if (request.host !== undefined) {
      updates.push('host = ?');
      params.push(request.host);
    }
    if (request.port !== undefined) {
      updates.push('port = ?');
      params.push(request.port);
    }
    if (request.user !== undefined) {
      updates.push('user = ?');
      params.push(request.user);
    }
    if (request.password !== undefined) {
      const encryptedPassword = encryptPassword(request.password, masterKey);
      updates.push('password = ?');
      params.push(JSON.stringify(encryptedPassword));
    }

    if (updates.length === 0) return;

    params.push(id);

    this.executeWithRetry(() => {
      const stmt = this.db.prepare(`
        UPDATE connections
        SET ${updates.join(', ')}
        WHERE id = ?
      `);

      stmt.run(...params);
    });
  }

  /**
   * Delete connection
   */
  deleteConnection(id: string): void {
    this.executeWithRetry(() => {
      const stmt = this.db.prepare('DELETE FROM connections WHERE id = ?');
      stmt.run(id);
    });
  }

  /**
   * Get the default connection ID (for new instances)
   */
  getDefaultConnectionId(): string | null {
    return this.getSetting('defaultConnection');
  }

  /**
   * Set the default connection ID (for new instances)
   * This does NOT affect currently running instances
   */
  setDefaultConnectionId(id: string): void {
    // Validate connection exists
    const conn = this.getConnection(id);
    if (!conn) {
      throw new Error(`Connection ${id} not found`);
    }

    this.setSetting('defaultConnection', id);
  }

  /**
   * @deprecated Use getDefaultConnectionId() and setDefaultConnectionId() instead
   * Kept for backwards compatibility, but now only updates the default setting
   */
  switchConnection(id: string): void {
    console.warn('switchConnection() is deprecated. Use setDefaultConnectionId() instead.');
    this.setDefaultConnectionId(id);
  }

  /**
   * Get decrypted password for a connection
   */
  getDecryptedPassword(connectionId: string, masterKey: string): string {
    const conn = this.getConnection(connectionId);
    if (!conn) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const encryptedData = JSON.parse(conn.password);
    return decryptPassword(encryptedData, masterKey);
  }

  // ============================================================================
  // Database Management
  // ============================================================================

  /**
   * Add databases to a connection
   */
  addDatabases(connectionId: string, databaseNames: string[], setFirstActive: boolean = false): string[] {
    const added: string[] = [];

    for (let i = 0; i < databaseNames.length; i++) {
      const dbName = databaseNames[i];
      const id = `db_${generateToken(12)}`;
      const is_active = setFirstActive && i === 0 ? 1 : 0;

      try {
        this.executeWithRetry(() => {
          const stmt = this.db.prepare(`
            INSERT INTO databases (
              id, connection_id, name, is_active,
              select_perm, insert_perm, update_perm, delete_perm,
              create_perm, alter_perm, drop_perm, truncate_perm
            ) VALUES (?, ?, ?, ?, 1, 0, 0, 0, 0, 0, 0, 0)
          `);

          stmt.run(id, connectionId, dbName, is_active);
        });
        added.push(dbName);
      } catch (error) {
        // Database might already exist
        console.error(`Failed to add database ${dbName}:`, error);
      }
    }

    return added;
  }

  /**
   * Get databases by connection ID
   */
  private getDatabasesByConnection(connectionId: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM databases
      WHERE connection_id = ?
      ORDER BY name
    `);

    return stmt.all(connectionId);
  }

  /**
   * Convert database row to Permissions object
   */
  private dbRowToPermissions(row: any): Permissions {
    return {
      select: Boolean(row.select_perm),
      insert: Boolean(row.insert_perm),
      update: Boolean(row.update_perm),
      delete: Boolean(row.delete_perm),
      create: Boolean(row.create_perm),
      alter: Boolean(row.alter_perm),
      drop: Boolean(row.drop_perm),
      truncate: Boolean(row.truncate_perm),
    };
  }

  /**
   * Update database permissions
   */
  updateDatabasePermissions(connectionId: string, databaseName: string, permissions: Permissions): void {
    this.executeWithRetry(() => {
      const stmt = this.db.prepare(`
        UPDATE databases
        SET select_perm = ?, insert_perm = ?, update_perm = ?, delete_perm = ?,
            create_perm = ?, alter_perm = ?, drop_perm = ?, truncate_perm = ?
        WHERE connection_id = ? AND name = ?
      `);

      stmt.run(
        permissions.select ? 1 : 0,
        permissions.insert ? 1 : 0,
        permissions.update ? 1 : 0,
        permissions.delete ? 1 : 0,
        permissions.create ? 1 : 0,
        permissions.alter ? 1 : 0,
        permissions.drop ? 1 : 0,
        permissions.truncate ? 1 : 0,
        connectionId,
        databaseName
      );
    });
  }

  /**
   * Switch active database
   */
  switchDatabase(connectionId: string, databaseName: string): void {
    this.executeWithRetry(() => {
      // Deactivate all databases for this connection
      this.db.prepare('UPDATE databases SET is_active = 0 WHERE connection_id = ?').run(connectionId);

      // Activate the specified database
      this.db.prepare('UPDATE databases SET is_active = 1 WHERE connection_id = ? AND name = ?')
        .run(connectionId, databaseName);
    });
  }

  /**
   * Get active database for a connection
   */
  getActiveDatabase(connectionId: string): string | null {
    const stmt = this.db.prepare(`
      SELECT name FROM databases
      WHERE connection_id = ? AND is_active = 1
      LIMIT 1
    `);

    const row = stmt.get(connectionId) as { name: string } | undefined;
    return row?.name || null;
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig(connectionId: string, databaseName: string): DatabaseConfig | null {
    const stmt = this.db.prepare(`
      SELECT * FROM databases
      WHERE connection_id = ? AND name = ?
    `);

    const row = stmt.get(connectionId, databaseName) as any;
    if (!row) return null;

    return {
      name: row.name,
      permissions: this.dbRowToPermissions(row),
    };
  }

  // ============================================================================
  // Request Logging
  // ============================================================================

  /**
   * Log a request
   */
  logRequest(
    apiKeyId: string | null,
    endpoint: string,
    method: string,
    requestBody: any,
    responseBody: any,
    statusCode: number,
    durationMs: number,
    userId?: string | null
  ): void {
    try {
      this.executeWithRetry(() => {
        const stmt = this.db.prepare(`
          INSERT INTO request_logs (
            api_key_id, user_id, endpoint, method, request_body, response_body,
            status_code, duration_ms, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          apiKeyId,
          userId || null,
          endpoint,
          method,
          requestBody ? JSON.stringify(requestBody) : null,
          responseBody ? JSON.stringify(responseBody) : null,
          statusCode,
          durationMs,
          Date.now()
        );
      });
    } catch (error: any) {
      // Log failure but don't crash the request
      console.error('Failed to log request after retries:', error.message);
    }
  }

  /**
   * Get request logs with pagination
   */
  getRequestLogs(limit: number = 100, offset: number = 0, apiKeyId?: string, search?: string): RequestLog[] {
    let query = `
      SELECT * FROM request_logs
    `;

    const params: any[] = [];
    const whereClauses: string[] = [];

    if (apiKeyId) {
      whereClauses.push('api_key_id = ?');
      params.push(apiKeyId);
    }

    if (search) {
      whereClauses.push('(endpoint LIKE ? OR method LIKE ? OR request_body LIKE ? OR response_body LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as RequestLog[];
  }

  /**
   * Get total count of request logs (for pagination)
   */
  getRequestLogsCount(apiKeyId?: string, search?: string): number {
    let query = `
      SELECT COUNT(*) as count FROM request_logs
    `;

    const params: any[] = [];
    const whereClauses: string[] = [];

    if (apiKeyId) {
      whereClauses.push('api_key_id = ?');
      params.push(apiKeyId);
    }

    if (search) {
      whereClauses.push('(endpoint LIKE ? OR method LIKE ? OR request_body LIKE ? OR response_body LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }

  /**
   * Get a single request log by ID
   */
  getRequestLogById(id: number): RequestLog | null {
    const stmt = this.db.prepare('SELECT * FROM request_logs WHERE id = ?');
    const log = stmt.get(id);
    return log ? (log as RequestLog) : null;
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): any {
    const totalRequests = this.db.prepare('SELECT COUNT(*) as count FROM request_logs').get() as { count: number };

    const byApiKey = this.db.prepare(`
      SELECT api_key_id, COUNT(*) as count
      FROM request_logs
      GROUP BY api_key_id
    `).all();

    const byEndpoint = this.db.prepare(`
      SELECT endpoint, COUNT(*) as count
      FROM request_logs
      GROUP BY endpoint
      ORDER BY count DESC
      LIMIT 10
    `).all();

    return {
      totalRequests: totalRequests.count,
      byApiKey,
      byEndpoint,
    };
  }

  /**
   * Clear old logs (older than days)
   */
  clearOldLogs(days: number = 30): number {
    return this.executeWithRetry(() => {
      const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
      const stmt = this.db.prepare('DELETE FROM request_logs WHERE timestamp < ?');
      const result = stmt.run(cutoffTime);
      return result.changes;
    });
  }

  // ============================================================================
  // Settings
  // ============================================================================

  /**
   * Get setting value
   */
  getSetting(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value || null;
  }

  /**
   * Set setting value
   */
  setSetting(key: string, value: string): void {
    this.executeWithRetry(() => {
      const stmt = this.db.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = ?
      `);
      stmt.run(key, value, value);
    });
  }

  /**
   * Set setting value only if it doesn't already exist (atomic operation)
   * Returns true if the value was set, false if it already existed
   */
  setSettingIfNotExists(key: string, value: string): boolean {
    return this.executeWithRetry(() => {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
      `);
      const result = stmt.run(key, value);
      return result.changes > 0;
    });
  }

  /**
   * Delete setting
   */
  deleteSetting(key: string): void {
    this.executeWithRetry(() => {
      const stmt = this.db.prepare('DELETE FROM settings WHERE key = ?');
      stmt.run(key);
    });
  }
}

// Singleton instance
let dbManagerInstance: DatabaseManager | null = null;

/**
 * Get or create the database manager singleton
 */
export function getDatabaseManager(): DatabaseManager {
  if (!dbManagerInstance) {
    dbManagerInstance = new DatabaseManager();
  }
  return dbManagerInstance;
}
