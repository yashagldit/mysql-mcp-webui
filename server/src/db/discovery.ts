import type { Pool } from 'mysql2/promise';

// System databases to exclude from discovery
const SYSTEM_DATABASES = ['information_schema', 'mysql', 'performance_schema', 'sys'];

export interface DatabaseMetadata {
  name: string;
  tableCount: number;
  sizeBytes: number;
  sizeFormatted: string;
}

export class DatabaseDiscovery {
  /**
   * Discover all non-system databases from a MySQL connection
   */
  async discoverDatabases(pool: Pool): Promise<string[]> {
    try {
      const [rows] = await pool.query('SHOW DATABASES');
      const databases = (rows as { Database: string }[])
        .map((row) => row.Database)
        .filter((db) => !SYSTEM_DATABASES.includes(db));

      return databases;
    } catch (error) {
      throw new Error(`Failed to discover databases: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get metadata for a specific database
   */
  async getDatabaseMetadata(pool: Pool, databaseName: string): Promise<DatabaseMetadata> {
    try {
      // Get table count
      const [tableRows] = await pool.query(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ?`,
        [databaseName]
      );
      const tableCount = (tableRows as { count: number }[])[0].count;

      // Get database size
      const [sizeRows] = await pool.query(
        `SELECT
          SUM(data_length + index_length) as size_bytes
        FROM information_schema.tables
        WHERE table_schema = ?`,
        [databaseName]
      );
      const sizeBytes = (sizeRows as { size_bytes: number | null }[])[0].size_bytes || 0;
      const sizeFormatted = this.formatBytes(sizeBytes);

      return {
        name: databaseName,
        tableCount,
        sizeBytes,
        sizeFormatted,
      };
    } catch (error) {
      throw new Error(
        `Failed to get metadata for database ${databaseName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get metadata for multiple databases
   */
  async getDatabasesMetadata(pool: Pool, databaseNames: string[]): Promise<DatabaseMetadata[]> {
    const metadataPromises = databaseNames.map((name) => this.getDatabaseMetadata(pool, name));
    return Promise.all(metadataPromises);
  }

  /**
   * Format bytes to human-readable size
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);

    return `${value.toFixed(1)} ${units[i]}`;
  }

  /**
   * Check if a database exists
   */
  async databaseExists(pool: Pool, databaseName: string): Promise<boolean> {
    try {
      const [rows] = await pool.query('SHOW DATABASES LIKE ?', [databaseName]);
      return (rows as unknown[]).length > 0;
    } catch (error) {
      throw new Error(
        `Failed to check if database exists: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get list of tables in a database
   */
  async getTables(pool: Pool, databaseName: string): Promise<string[]> {
    try {
      const [rows] = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
        [databaseName]
      );
      return (rows as { table_name: string }[]).map((row) => row.table_name);
    } catch (error) {
      throw new Error(
        `Failed to get tables for database ${databaseName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Singleton instance
let discoveryInstance: DatabaseDiscovery | null = null;

/**
 * Get or create the database discovery singleton
 */
export function getDatabaseDiscovery(): DatabaseDiscovery {
  if (!discoveryInstance) {
    discoveryInstance = new DatabaseDiscovery();
  }
  return discoveryInstance;
}
