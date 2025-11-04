import mysql from 'mysql2/promise';
import type { Pool, PoolOptions } from 'mysql2/promise';
import type { ConnectionConfig } from '../types/index.js';
import { getDatabaseManager } from './database-manager.js';
import { getMasterKey } from '../config/master-key.js';

export class ConnectionManager {
  private pools: Map<string, Pool> = new Map();
  private dbManager = getDatabaseManager();
  private masterKey = getMasterKey();

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
   * Get the pool for the currently active connection
   */
  async getActivePool(): Promise<{ pool: Pool; connectionId: string; database: string }> {
    const connection = this.dbManager.getActiveConnection();

    if (!connection) {
      throw new Error('No active connection configured');
    }

    if (!connection.activeDatabase) {
      throw new Error('No active database selected');
    }

    const pool = await this.getPool(connection.id);

    return {
      pool,
      connectionId: connection.id,
      database: connection.activeDatabase,
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
