import type Database from 'better-sqlite3';
import { getDatabase } from './schema.js';
import { generateToken, encryptPassword, decryptPassword } from '../config/crypto.js';
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

export interface RequestLog {
  id: number;
  api_key_id: string;
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
   * Initialize with default values (create first API key if none exist)
   */
  private initializeDefaults(): void {
    const keys = this.getAllApiKeys();
    if (keys.length === 0) {
      const defaultKey = this.createApiKey('Default API Key');
      console.error(`Created default API key: ${defaultKey.key}`);
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

    const stmt = this.db.prepare(`
      INSERT INTO api_keys (id, name, key, created_at, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);

    stmt.run(id, name, key, created_at);

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
    const stmt = this.db.prepare(`
      UPDATE api_keys
      SET name = ?
      WHERE id = ?
    `);

    stmt.run(name, id);
  }

  /**
   * Update last_used_at timestamp
   */
  private updateApiKeyLastUsed(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE api_keys
      SET last_used_at = ?
      WHERE id = ?
    `);

    stmt.run(Date.now(), id);
  }

  /**
   * Revoke (deactivate) API key
   */
  revokeApiKey(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE api_keys
      SET is_active = 0
      WHERE id = ?
    `);

    stmt.run(id);
  }

  /**
   * Delete API key
   */
  deleteApiKey(id: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM api_keys
      WHERE id = ?
    `);

    stmt.run(id);
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

    // Add discovered databases
    if (autoDiscover.length > 0) {
      this.addDatabases(id, autoDiscover, is_active === 1);
    }

    // If this is the active connection, set the setting
    if (is_active) {
      this.setSetting('activeConnection', id);
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
   * Get active connection
   */
  getActiveConnection(): ConnectionConfig | null {
    const activeConnId = this.getSetting('activeConnection');
    if (!activeConnId) {
      // Fallback: get any active connection
      const stmt = this.db.prepare(`
        SELECT id FROM connections WHERE is_active = 1 LIMIT 1
      `);
      const row = stmt.get() as { id: string } | undefined;
      if (!row) return null;
      return this.getConnection(row.id);
    }

    return this.getConnection(activeConnId);
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

    const stmt = this.db.prepare(`
      UPDATE connections
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...params);
  }

  /**
   * Delete connection
   */
  deleteConnection(id: string): void {
    const stmt = this.db.prepare('DELETE FROM connections WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Switch active connection
   */
  switchConnection(id: string): void {
    // Deactivate all connections
    this.db.prepare('UPDATE connections SET is_active = 0').run();

    // Activate the specified connection
    this.db.prepare('UPDATE connections SET is_active = 1 WHERE id = ?').run(id);

    // Update setting
    this.setSetting('activeConnection', id);
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
        const stmt = this.db.prepare(`
          INSERT INTO databases (
            id, connection_id, name, is_active,
            select_perm, insert_perm, update_perm, delete_perm,
            create_perm, alter_perm, drop_perm, truncate_perm
          ) VALUES (?, ?, ?, ?, 1, 0, 0, 0, 0, 0, 0, 0)
        `);

        stmt.run(id, connectionId, dbName, is_active);
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
  }

  /**
   * Switch active database
   */
  switchDatabase(connectionId: string, databaseName: string): void {
    // Deactivate all databases for this connection
    this.db.prepare('UPDATE databases SET is_active = 0 WHERE connection_id = ?').run(connectionId);

    // Activate the specified database
    this.db.prepare('UPDATE databases SET is_active = 1 WHERE connection_id = ? AND name = ?')
      .run(connectionId, databaseName);
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
    apiKeyId: string,
    endpoint: string,
    method: string,
    requestBody: any,
    responseBody: any,
    statusCode: number,
    durationMs: number
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO request_logs (
        api_key_id, endpoint, method, request_body, response_body,
        status_code, duration_ms, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      apiKeyId,
      endpoint,
      method,
      requestBody ? JSON.stringify(requestBody) : null,
      responseBody ? JSON.stringify(responseBody) : null,
      statusCode,
      durationMs,
      Date.now()
    );
  }

  /**
   * Get request logs with pagination
   */
  getRequestLogs(limit: number = 100, offset: number = 0, apiKeyId?: string): RequestLog[] {
    let query = `
      SELECT * FROM request_logs
    `;

    const params: any[] = [];

    if (apiKeyId) {
      query += ' WHERE api_key_id = ?';
      params.push(apiKeyId);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as RequestLog[];
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
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const stmt = this.db.prepare('DELETE FROM request_logs WHERE timestamp < ?');
    const result = stmt.run(cutoffTime);
    return result.changes;
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
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?
    `);
    stmt.run(key, value, value);
  }

  /**
   * Delete setting
   */
  deleteSetting(key: string): void {
    const stmt = this.db.prepare('DELETE FROM settings WHERE key = ?');
    stmt.run(key);
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
