import mysql from 'mysql2/promise';
import type { Pool, PoolOptions } from 'mysql2/promise';
import type { ConnectionConfig } from '../types/index.js';
import { getDatabaseManager } from './database-manager.js';
import { getMasterKey } from '../config/master-key.js';
import { loadEnvironment } from '../config/environment.js';

export interface DatabaseContext {
  connectionId: string;
  database: string;
  alias: string;
  connectionName: string;
  lastAccessed: number;
}

export class ConnectionManager {
  private pools: Map<string, Pool> = new Map();
  private dbManager = getDatabaseManager();
  private masterKey = getMasterKey();
  private config = loadEnvironment();

  // In-memory active state (per process instance) - v4.0 alias-based
  private activeConnections: Set<string> = new Set(); // connectionIds
  private activeDatabases: Map<string, DatabaseContext> = new Map(); // alias -> context
  private currentDatabaseAlias: string | null = null;

  constructor() {
    // Initialize from database on startup
    const currentAlias = this.dbManager.getCurrentDatabaseAlias();
    if (currentAlias) {
      const dbContext = this.dbManager.getDatabaseByAlias(currentAlias);
      if (dbContext) {
        this.currentDatabaseAlias = currentAlias;
        this.activeConnections.add(dbContext.connectionId);
        this.activeDatabases.set(currentAlias, {
          ...dbContext,
          lastAccessed: Date.now(),
        });
      }
    }
  }

  /**
   * Get or create a connection pool for a specific connection
   */
  async getPool(connectionId: string): Promise<Pool> {
    // Check if pool already exists
    if (this.pools.has(connectionId)) {
      return this.pools.get(connectionId)!;
    }

    // Get connection config
    const connection = this.dbManager.getConnection(connectionId);

    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    // Decrypt password
    const password = this.dbManager.getDecryptedPassword(connectionId, this.masterKey);

    // Create pool options
    const poolOptions: PoolOptions = {
      host: connection.host,
      port: connection.port,
      user: connection.user,
      password: password,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    };

    // Create pool
    const pool = mysql.createPool(poolOptions);

    // Test connection
    try {
      const conn = await pool.getConnection();
      conn.release();
    } catch (error) {
      await pool.end();
      throw new Error(
        `Failed to connect to ${connection.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Store pool
    this.pools.set(connectionId, pool);
    return pool;
  }

  /**
   * Get pool for a specific database by alias
   */
  async getPoolForDatabase(alias: string): Promise<{ pool: Pool; context: DatabaseContext }> {
    const context = this.dbManager.getDatabaseByAlias(alias);
    if (!context) {
      throw new Error(`Database with alias '${alias}' not found`);
    }

    const pool = await this.getPool(context.connectionId);

    return {
      pool,
      context: {
        ...context,
        lastAccessed: Date.now(),
      },
    };
  }

  /**
   * Activate a database by alias (adds to active set)
   */
  async activateDatabase(alias: string): Promise<void> {
    // Check if already active
    if (this.activeDatabases.has(alias)) {
      // Update last accessed
      const context = this.activeDatabases.get(alias)!;
      context.lastAccessed = Date.now();
      this.dbManager.updateLastAccessed(alias);
      return;
    }

    // Get database context
    const dbContext = this.dbManager.getDatabaseByAlias(alias);
    if (!dbContext) {
      throw new Error(`Database with alias '${alias}' not found`);
    }

    // Check if we need to evict databases (reached limit)
    if (this.activeDatabases.size >= this.config.maxActiveDatabases) {
      this.evictLRUDatabase();
    }

    // Add to active databases
    const context: DatabaseContext = {
      ...dbContext,
      lastAccessed: Date.now(),
    };
    this.activeDatabases.set(alias, context);
    this.activeConnections.add(dbContext.connectionId);

    // Update database as active in DB
    this.dbManager.setDatabaseActive(alias, true);

    // Check if we need to evict connections (reached limit)
    if (this.activeConnections.size > this.config.maxActiveConnections) {
      await this.evictUnusedConnections();
    }
  }

  /**
   * Deactivate a database by alias (removes from active set)
   */
  deactivateDatabase(alias: string): void {
    const context = this.activeDatabases.get(alias);
    if (!context) {
      return; // Already inactive
    }

    // Remove from active databases
    this.activeDatabases.delete(alias);

    // Update database as inactive in DB
    this.dbManager.setDatabaseActive(alias, false);

    // Check if connection has no more active databases
    const hasOtherDbs = Array.from(this.activeDatabases.values()).some(
      (ctx) => ctx.connectionId === context.connectionId
    );
    if (!hasOtherDbs) {
      this.activeConnections.delete(context.connectionId);
    }

    // If this was the current database, clear current
    if (this.currentDatabaseAlias === alias) {
      this.currentDatabaseAlias = null;
      this.dbManager.setCurrentDatabaseAlias('');
    }
  }

  /**
   * Set the current/default database
   */
  setCurrentDatabase(alias: string): void {
    const context = this.dbManager.getDatabaseByAlias(alias);
    if (!context) {
      throw new Error(`Database with alias '${alias}' not found`);
    }

    this.currentDatabaseAlias = alias;
    this.dbManager.setCurrentDatabaseAlias(alias);
  }

  /**
   * Get the current database
   */
  getCurrentDatabase(): DatabaseContext | null {
    if (!this.currentDatabaseAlias) {
      return null;
    }

    return this.activeDatabases.get(this.currentDatabaseAlias) || null;
  }

  /**
   * Get all active databases
   */
  getActiveDatabases(): DatabaseContext[] {
    return Array.from(this.activeDatabases.values());
  }

  /**
   * Get all active connection IDs
   */
  getActiveConnections(): Set<string> {
    return new Set(this.activeConnections);
  }

  /**
   * Update last accessed time for a database
   */
  updateLastAccessed(alias: string): void {
    const context = this.activeDatabases.get(alias);
    if (context) {
      context.lastAccessed = Date.now();
      this.dbManager.updateLastAccessed(alias);
    }
  }

  /**
   * Evict the least recently used database
   */
  private evictLRUDatabase(): void {
    // Don't evict the current database
    const candidates = Array.from(this.activeDatabases.entries())
      .filter(([alias]) => alias !== this.currentDatabaseAlias);

    if (candidates.length === 0) {
      console.warn('Cannot evict databases: only current database is active');
      return;
    }

    // Find LRU
    const [lruAlias] = candidates.reduce((min, current) =>
      current[1].lastAccessed < min[1].lastAccessed ? current : min
    );

    console.log(`Evicting LRU database: ${lruAlias} (limit: ${this.config.maxActiveDatabases})`);
    this.deactivateDatabase(lruAlias);
  }

  /**
   * Evict connections that have no active databases
   */
  private async evictUnusedConnections(): Promise<void> {
    const unusedConnections: string[] = [];

    for (const connectionId of this.activeConnections) {
      const hasDatabases = Array.from(this.activeDatabases.values()).some(
        (ctx) => ctx.connectionId === connectionId
      );

      if (!hasDatabases) {
        unusedConnections.push(connectionId);
      }
    }

    // Close pools for unused connections
    for (const connectionId of unusedConnections) {
      await this.closePool(connectionId);
      this.activeConnections.delete(connectionId);
      console.log(`Evicted unused connection: ${connectionId}`);
    }
  }

  // ============================================================================
  // Legacy methods for backward compatibility (deprecated)
  // ============================================================================

  /**
   * @deprecated Use getCurrentDatabase() instead
   */
  getActiveConnectionId(): string | null {
    return this.currentDatabaseAlias ? this.getCurrentDatabase()?.connectionId || null : null;
  }

  /**
   * @deprecated Use activateDatabase() instead
   */
  setActiveConnectionId(_connectionId: string): void {
    console.warn('setActiveConnectionId is deprecated, use activateDatabase with alias instead');
  }

  /**
   * @deprecated Use getCurrentDatabase() instead
   */
  getActiveDatabase(_connectionId?: string): string | null {
    return this.getCurrentDatabase()?.database || null;
  }

  /**
   * @deprecated Use setCurrentDatabase() and activateDatabase() instead
   */
  setActiveDatabase(_connectionId: string, _database: string): void {
    console.warn('setActiveDatabase is deprecated, use setCurrentDatabase with alias instead');
  }

  /**
   * @deprecated Use getPoolForDatabase() instead
   */
  async getActivePool(): Promise<{ pool: Pool; connectionId: string; database: string }> {
    if (!this.currentDatabaseAlias) {
      throw new Error('No current database set. Please visit http://localhost:9274 to configure.');
    }

    const result = await this.getPoolForDatabase(this.currentDatabaseAlias);
    return {
      pool: result.pool,
      connectionId: result.context.connectionId,
      database: result.context.database,
    };
  }

  /**
   * Test a connection without creating a persistent pool
   */
  async testConnection(connection: ConnectionConfig, password: string): Promise<{ latency: number; databases: string[] }> {
    const startTime = Date.now();

    const poolOptions: PoolOptions = {
      host: connection.host,
      port: connection.port,
      user: connection.user,
      password: password,
      connectionLimit: 1,
    };

    const pool = mysql.createPool(poolOptions);

    try {
      const conn = await pool.getConnection();

      // Get databases
      const [rows] = await conn.query('SHOW DATABASES');
      conn.release();

      const databases = (rows as { Database: string }[])
        .map((row) => row.Database)
        .filter((db) => !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(db));

      const latency = Date.now() - startTime;

      return { latency, databases };
    } catch (error) {
      throw new Error(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await pool.end();
    }
  }

  /**
   * Close a specific pool
   */
  async closePool(connectionId: string): Promise<void> {
    const pool = this.pools.get(connectionId);
    if (pool) {
      await pool.end();
      this.pools.delete(connectionId);
    }
  }

  /**
   * Close all pools (for graceful shutdown)
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.pools.values()).map((pool) => pool.end());
    await Promise.all(closePromises);
    this.pools.clear();
  }

  /**
   * Recreate a pool (useful after connection config changes)
   */
  async recreatePool(connectionId: string): Promise<void> {
    await this.closePool(connectionId);
    await this.getPool(connectionId);
  }
}

// Singleton instance
let connectionManagerInstance: ConnectionManager | null = null;

/**
 * Get or create the connection manager singleton
 */
export function getConnectionManager(): ConnectionManager {
  if (!connectionManagerInstance) {
    connectionManagerInstance = new ConnectionManager();
  }
  return connectionManagerInstance;
}
