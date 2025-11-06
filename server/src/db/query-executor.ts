import type { Pool, PoolConnection, FieldPacket, RowDataPacket } from 'mysql2/promise';
import type { Permissions, QueryResult } from '../types/index.js';
import { getPermissionValidator } from './permissions.js';
import { getConnectionManager } from './connection-manager.js';
import { getSessionManager } from '../mcp/session-manager.js';
import { getDatabaseManager } from './database-manager.js';

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
      throw new Error('No active connection configured. Please visit http://localhost:9274 to add a database connection.');
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
   */
  async executeQuery(sql: string): Promise<QueryResult> {
    const startTime = Date.now();

    // Get active connection and database (session-aware)
    const { pool, connectionId, database } = await this.getActivePool();

    // Get permissions for the active database
    const dbConfig = this.dbManager.getDatabaseConfig(connectionId, database);

    if (!dbConfig) {
      throw new Error(`Database ${database} not found in connection configuration`);
    }

    const permissions = dbConfig.permissions;

    // Validate query against permissions
    const validation = this.permissionValidator.validateQuery(sql, permissions);

    if (!validation.allowed) {
      throw new Error(validation.reason || 'Query not allowed');
    }

    // Execute query based on type
    let result: QueryResult;

    if (this.permissionValidator.isReadOperation(validation.queryType)) {
      result = await this.executeReadQuery(pool, database, sql);
    } else {
      result = await this.executeWriteQuery(pool, database, sql);
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
    const connection = await pool.getConnection();

    try {
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
      // Rollback on error
      try {
        await connection.rollback();
      } catch (rollbackError) {
        // Ignore rollback errors
      }

      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      connection.release();
    }
  }

  /**
   * Execute a write query (INSERT, UPDATE, DELETE, etc.) with normal transaction
   */
  private async executeWriteQuery(pool: Pool, database: string, sql: string): Promise<QueryResult> {
    const connection = await pool.getConnection();

    try {
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
      // Rollback on error
      try {
        await connection.rollback();
      } catch (rollbackError) {
        // Ignore rollback errors
      }

      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      connection.release();
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
    const conn = await pool.getConnection();

    try {
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
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      conn.release();
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
