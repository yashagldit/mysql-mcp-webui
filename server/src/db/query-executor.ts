import type { Pool, PoolConnection, FieldPacket, RowDataPacket } from 'mysql2/promise';
import type { Permissions, QueryResult } from '../types/index.js';
import { getPermissionValidator } from './permissions.js';
import { getConnectionManager } from './connection-manager.js';
import { getSessionManager } from '../mcp/session-manager.js';
import { getDatabaseManager } from './database-manager.js';

// MySQL error codes that mean the underlying socket is unusable. When we see
// these we destroy the connection rather than returning it to the pool, so a
// dead socket can't be handed to the next query (the failure mode behind
// "MCP gets stuck after a few queries").
const FATAL_CONN_ERRORS = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ER_SERVER_SHUTDOWN',
  'PROTOCOL_PACKETS_OUT_OF_ORDER',
  'PROTOCOL_INCORRECT_PACKET_SEQUENCE',
]);

function isFatalConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  return code !== undefined && FATAL_CONN_ERRORS.has(code);
}

function safeReleaseConnection(connection: PoolConnection | null, broken: boolean): void {
  if (!connection) return;
  try {
    if (broken) {
      connection.destroy();
    } else {
      connection.release();
    }
  } catch (releaseError) {
    // Last-ditch destroy if release fails — we never want to leak the slot
    try { connection.destroy(); } catch { /* ignore */ }
  }
}

export class QueryExecutor {
  private permissionValidator = getPermissionValidator();
  private connectionManager = getConnectionManager();
  private sessionManager = getSessionManager();
  private dbManager = getDatabaseManager();
  private currentSessionId: string | null = null;
  private transportMode: 'stdio' | 'http' = 'stdio';

  /**
   * Set session context for HTTP mode
   */
  setSession(sessionId: string | null, mode: 'stdio' | 'http'): void {
    this.currentSessionId = sessionId;
    this.transportMode = mode;
  }

  /**
   * Get active pool based on transport mode (session-aware)
   * Falls back to ConnectionManager if no session context is set
   */
  private async getActivePool(): Promise<{ pool: Pool; connectionId: string; database: string }> {
    let connectionId: string | null;
    let database: string | null;

    // Get active connection and database based on context
    // Use SessionManager only if we have both HTTP mode AND a session ID
    // Otherwise fall back to ConnectionManager (for WebUI browse API, stdio mode, etc.)
    if (this.transportMode === 'http' && this.currentSessionId) {
      // MCP HTTP mode with session - use SessionManager
      connectionId = this.sessionManager.getActiveConnection(this.currentSessionId);
      database = connectionId ? this.sessionManager.getActiveDatabase(this.currentSessionId, connectionId) : null;
    } else {
      // Default: use ConnectionManager (WebUI browse API, stdio mode, or no session)
      connectionId = this.connectionManager.getActiveConnectionId();
      database = connectionId ? this.connectionManager.getActiveDatabase(connectionId) : null;
    }

    if (!connectionId) {
      throw new Error('No active connection configured. Use the add_connection tool to add a MySQL connection, or visit http://localhost:9274 to configure via the web interface.');
    }

    if (!database) {
      throw new Error('No active database selected');
    }

    const pool = await this.connectionManager.getPool(connectionId);

    return {
      pool,
      connectionId,
      database,
    };
  }

  /**
   * Execute a SQL query with permission checking and transaction support
   * @param sql SQL query to execute
   * @param connectionId Connection ID (optional for backward compatibility)
   * @param database Database name (optional for backward compatibility)
   * @param apiKeyId Calling API key (optional). When set and the key is in one
   *   or more groups, the database must be in one of those groups and the
   *   merged group permissions are used in place of the per-database perms.
   */
  async executeQuery(
    sql: string,
    connectionId?: string,
    database?: string,
    apiKeyId?: string | null
  ): Promise<QueryResult> {
    const startTime = Date.now();

    // If connectionId and database are provided, use them directly
    // Otherwise fall back to the old behavior (get from active pool)
    let pool: Pool;
    let actualConnectionId: string;
    let actualDatabase: string;

    if (connectionId && database) {
      // v4.0: Explicit connection + database parameters
      actualConnectionId = connectionId;
      actualDatabase = database;
      pool = await this.connectionManager.getPool(connectionId);
    } else {
      // Legacy: Use getActivePool() for backward compatibility
      const activePool = await this.getActivePool();
      pool = activePool.pool;
      actualConnectionId = activePool.connectionId;
      actualDatabase = activePool.database;
    }

    // Get permissions for the database
    const dbConfig = this.dbManager.getDatabaseConfig(actualConnectionId, actualDatabase);

    if (!dbConfig) {
      throw new Error(`Database ${actualDatabase} not found in connection configuration`);
    }

    // v3.3: Group-based access. If the API key is in any groups, scope and
    // permissions come from those groups; otherwise fall back to per-DB perms.
    let permissions = dbConfig.permissions;
    if (apiKeyId) {
      const accessible = this.dbManager.getAccessibleDatabaseIdsForApiKey(apiKeyId);
      if (accessible !== null) {
        const dbId = this.dbManager.getDatabaseId(actualConnectionId, actualDatabase);
        if (!dbId || !accessible.has(dbId)) {
          throw new Error(
            `Access denied: database '${actualDatabase}' is not in any group assigned to this API key`
          );
        }
        const effective = this.dbManager.getEffectivePermissionsForApiKey(apiKeyId, dbId);
        if (!effective) {
          throw new Error(
            `Access denied: database '${actualDatabase}' is not in any group assigned to this API key`
          );
        }
        permissions = effective;
      }
    }

    // Validate query against permissions
    const validation = this.permissionValidator.validateQuery(sql, permissions);

    if (!validation.allowed) {
      throw new Error(validation.reason || 'Query not allowed');
    }

    // Execute query based on type
    let result: QueryResult;

    if (this.permissionValidator.isReadOperation(validation.queryType)) {
      result = await this.executeReadQuery(pool, actualDatabase, sql);
    } else {
      result = await this.executeWriteQuery(pool, actualDatabase, sql);
    }

    // Add execution time
    const executionTime = Date.now() - startTime;
    result.executionTime = `${executionTime}ms`;

    return result;
  }

  /**
   * Execute a read-only query (SELECT) with READ ONLY transaction
   */
  private async executeReadQuery(pool: Pool, database: string, sql: string): Promise<QueryResult> {
    let connection: PoolConnection | null = null;
    let brokenConnection = false;

    try {
      connection = await pool.getConnection();

      // Use the specified database
      await connection.query(`USE \`${database}\``);

      // Start READ ONLY transaction
      await connection.query('START TRANSACTION READ ONLY');

      // Execute query
      const [rows, fields] = await connection.query<RowDataPacket[]>(sql);

      // Commit transaction
      await connection.commit();

      return this.formatQueryResult(rows, fields);
    } catch (error) {
      brokenConnection = isFatalConnectionError(error);

      // Best-effort rollback only if the socket is still alive
      if (connection && !brokenConnection) {
        try {
          await connection.rollback();
        } catch {
          // If rollback fails the connection is unhealthy — don't reuse it
          brokenConnection = true;
        }
      }

      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      safeReleaseConnection(connection, brokenConnection);
    }
  }

  /**
   * Execute a write query (INSERT, UPDATE, DELETE, etc.) with normal transaction
   */
  private async executeWriteQuery(pool: Pool, database: string, sql: string): Promise<QueryResult> {
    let connection: PoolConnection | null = null;
    let brokenConnection = false;

    try {
      connection = await pool.getConnection();

      // Use the specified database
      await connection.query(`USE \`${database}\``);

      // Start transaction
      await connection.beginTransaction();

      // Execute query
      const [result, fields] = await connection.query(sql);

      // Commit transaction
      await connection.commit();

      return this.formatWriteResult(result, fields);
    } catch (error) {
      brokenConnection = isFatalConnectionError(error);

      if (connection && !brokenConnection) {
        try {
          await connection.rollback();
        } catch {
          brokenConnection = true;
        }
      }

      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      safeReleaseConnection(connection, brokenConnection);
    }
  }

  /**
   * Format query results for SELECT queries
   */
  private formatQueryResult(rows: RowDataPacket[], fields: FieldPacket[]): QueryResult {
    return {
      rows: rows as unknown[],
      fields: fields.map((field) => field.name),
      rowCount: rows.length,
      executionTime: '0ms', // Will be set by caller
    };
  }

  /**
   * Format results for write operations
   */
  private formatWriteResult(result: unknown, fields: FieldPacket[]): QueryResult {
    const resultObj = result as {
      affectedRows?: number;
      insertId?: number;
      changedRows?: number;
      warningStatus?: number;
    };

    return {
      rows: [
        {
          affectedRows: resultObj.affectedRows || 0,
          insertId: resultObj.insertId || 0,
          changedRows: resultObj.changedRows || 0,
        },
      ],
      fields: ['affectedRows', 'insertId', 'changedRows'],
      rowCount: resultObj.affectedRows || 0,
      executionTime: '0ms', // Will be set by caller
    };
  }

  /**
   * Execute a query for a specific connection and database (for testing/admin purposes)
   */
  async executeQueryForDatabase(
    connectionId: string,
    database: string,
    sql: string,
    skipPermissions: boolean = false
  ): Promise<QueryResult> {
    const startTime = Date.now();

    const pool = await this.connectionManager.getPool(connectionId);

    if (!skipPermissions) {
      // Get permissions
      const dbConfig = this.dbManager.getDatabaseConfig(connectionId, database);

      if (!dbConfig) {
        throw new Error(`Database ${database} not found in connection configuration`);
      }

      // Validate permissions
      const validation = this.permissionValidator.validateQuery(sql, dbConfig.permissions);
      if (!validation.allowed) {
        throw new Error(validation.reason || 'Query not allowed');
      }
    }

    // Execute query
    let conn: PoolConnection | null = null;
    let brokenConnection = false;

    try {
      conn = await pool.getConnection();
      await conn.query(`USE \`${database}\``);
      const [rows, fields] = await conn.query(sql);

      const executionTime = Date.now() - startTime;

      // Check if it's a SELECT result
      if (Array.isArray(rows)) {
        return {
          rows: rows as unknown[],
          fields: (fields as FieldPacket[]).map((f) => f.name),
          rowCount: rows.length,
          executionTime: `${executionTime}ms`,
        };
      } else {
        // Write operation result
        return this.formatWriteResult(rows, fields as FieldPacket[]);
      }
    } catch (error) {
      brokenConnection = isFatalConnectionError(error);
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      safeReleaseConnection(conn, brokenConnection);
    }
  }
}

// Singleton instance
let queryExecutorInstance: QueryExecutor | null = null;

/**
 * Get or create the query executor singleton
 */
export function getQueryExecutor(): QueryExecutor {
  if (!queryExecutorInstance) {
    queryExecutorInstance = new QueryExecutor();
  }
  return queryExecutorInstance;
}
