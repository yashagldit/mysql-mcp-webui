import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  Config,
  ConnectionConfig,
  DatabaseConfig,
  Permissions,
  EncryptedData,
  AddConnectionRequest,
  UpdateConnectionRequest,
} from '../types/index.js';
import { ConfigSchema, EncryptedDataSchema, defaultPermissions } from '../types/index.js';
import { generateToken, encryptPassword, decryptPassword } from './crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default config file path (in project root /config directory)
const DEFAULT_CONFIG_PATH = path.resolve(__dirname, '../../../config/config.json');

export class ConfigManager {
  private config: Config | null = null;
  private configPath: string;

  constructor(configPath: string = DEFAULT_CONFIG_PATH) {
    this.configPath = configPath;
  }

  /**
   * Load configuration from file, or create default if not exists
   */
  async loadConfig(): Promise<Config> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(configData);

      // Validate with Zod schema
      this.config = ConfigSchema.parse(parsed);
      return this.config;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, create default config
        console.log('Config file not found, creating default configuration...');
        this.config = this.createDefaultConfig();
        await this.saveConfig();
        return this.config;
      }
      throw new Error(`Failed to load config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save current configuration to file
   */
  async saveConfig(): Promise<void> {
    if (!this.config) {
      throw new Error('No config loaded');
    }

    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });

      // Write config with atomic operation (write to temp file, then rename)
      const tempPath = `${this.configPath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(this.config, null, 2), 'utf-8');
      await fs.rename(tempPath, this.configPath);
    } catch (error) {
      throw new Error(`Failed to save config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(): Config {
    return {
      serverToken: generateToken(64),
      transport: 'http',
      httpPort: 3000,
      connections: {},
    };
  }

  /**
   * Get the current configuration
   */
  getConfig(): Config {
    if (!this.config) {
      throw new Error('Config not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * Get active connection configuration
   */
  getActiveConnection(): ConnectionConfig | null {
    if (!this.config || !this.config.activeConnection) {
      return null;
    }
    return this.config.connections[this.config.activeConnection] || null;
  }

  /**
   * Get active database name
   */
  getActiveDatabase(): string | null {
    const activeConn = this.getActiveConnection();
    return activeConn?.activeDatabase || null;
  }

  /**
   * Get active database configuration
   */
  getActiveDatabaseConfig(): DatabaseConfig | null {
    const activeConn = this.getActiveConnection();
    if (!activeConn || !activeConn.activeDatabase) {
      return null;
    }
    return activeConn.databases[activeConn.activeDatabase] || null;
  }

  /**
   * Add a new connection
   */
  async addConnection(request: AddConnectionRequest, autoDiscover: string[] = []): Promise<string> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    // Generate unique ID
    const id = `conn_${generateToken(12)}`;

    // Encrypt password
    const encryptedPassword = encryptPassword(request.password, this.config.serverToken);

    // Create databases object from auto-discovered databases
    const databases: Record<string, DatabaseConfig> = {};
    for (const dbName of autoDiscover) {
      databases[dbName] = {
        name: dbName,
        permissions: { ...defaultPermissions },
        isEnabled: true,
      };
    }

    // Create connection config
    const connection: ConnectionConfig = {
      id,
      name: request.name,
      host: request.host,
      port: request.port,
      user: request.user,
      password: JSON.stringify(encryptedPassword),
      isActive: Object.keys(this.config.connections).length === 0, // First connection is active
      databases,
      activeDatabase: autoDiscover[0], // First database is active
    };

    // Add to connections
    this.config.connections[id] = connection;

    // Set as active if it's the first connection
    if (connection.isActive) {
      this.config.activeConnection = id;
    }

    await this.saveConfig();
    return id;
  }

  /**
   * Update an existing connection
   */
  async updateConnection(id: string, request: UpdateConnectionRequest): Promise<void> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    const connection = this.config.connections[id];
    if (!connection) {
      throw new Error(`Connection ${id} not found`);
    }

    // Update fields
    if (request.name !== undefined) connection.name = request.name;
    if (request.host !== undefined) connection.host = request.host;
    if (request.port !== undefined) connection.port = request.port;
    if (request.user !== undefined) connection.user = request.user;

    // Update password if provided
    if (request.password !== undefined) {
      const encryptedPassword = encryptPassword(request.password, this.config.serverToken);
      connection.password = JSON.stringify(encryptedPassword);
    }

    await this.saveConfig();
  }

  /**
   * Remove a connection
   */
  async removeConnection(id: string): Promise<void> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    if (!this.config.connections[id]) {
      throw new Error(`Connection ${id} not found`);
    }

    // Remove connection
    delete this.config.connections[id];

    // If this was the active connection, set another as active
    if (this.config.activeConnection === id) {
      const remainingIds = Object.keys(this.config.connections);
      if (remainingIds.length > 0) {
        this.config.activeConnection = remainingIds[0];
        this.config.connections[remainingIds[0]].isActive = true;
      } else {
        delete this.config.activeConnection;
      }
    }

    await this.saveConfig();
  }

  /**
   * Switch to a different connection
   */
  async switchConnection(id: string): Promise<void> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    const connection = this.config.connections[id];
    if (!connection) {
      throw new Error(`Connection ${id} not found`);
    }

    // Deactivate current active connection
    if (this.config.activeConnection) {
      const currentActive = this.config.connections[this.config.activeConnection];
      if (currentActive) {
        currentActive.isActive = false;
      }
    }

    // Activate new connection
    connection.isActive = true;
    this.config.activeConnection = id;

    await this.saveConfig();
  }

  /**
   * Add databases to a connection
   */
  async addDatabases(connectionId: string, databaseNames: string[]): Promise<string[]> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    const connection = this.config.connections[connectionId];
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const added: string[] = [];

    for (const dbName of databaseNames) {
      if (!connection.databases[dbName]) {
        connection.databases[dbName] = {
          name: dbName,
          permissions: { ...defaultPermissions },
          isEnabled: true,
        };
        added.push(dbName);
      }
    }

    // Set first database as active if none is active
    if (!connection.activeDatabase && databaseNames.length > 0) {
      connection.activeDatabase = databaseNames[0];
    }

    await this.saveConfig();
    return added;
  }

  /**
   * Update database permissions
   */
  async updateDatabasePermissions(
    connectionId: string,
    databaseName: string,
    permissions: Permissions
  ): Promise<void> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    const connection = this.config.connections[connectionId];
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const database = connection.databases[databaseName];
    if (!database) {
      throw new Error(`Database ${databaseName} not found in connection ${connectionId}`);
    }

    database.permissions = permissions;
    await this.saveConfig();
  }

  /**
   * Switch to a different database within a connection
   */
  async switchDatabase(connectionId: string, databaseName: string): Promise<void> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    const connection = this.config.connections[connectionId];
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const database = connection.databases[databaseName];
    if (!database) {
      throw new Error(`Database ${databaseName} not found in connection ${connectionId}`);
    }

    connection.activeDatabase = databaseName;
    await this.saveConfig();
  }

  /**
   * Get decrypted password for a connection
   */
  getDecryptedPassword(connectionId: string): string {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    const connection = this.config.connections[connectionId];
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    try {
      const encryptedData: EncryptedData = JSON.parse(connection.password);
      EncryptedDataSchema.parse(encryptedData); // Validate structure
      return decryptPassword(encryptedData, this.config.serverToken);
    } catch (error) {
      throw new Error(`Failed to decrypt password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rotate server token (requires re-encrypting all passwords)
   */
  async rotateToken(): Promise<string> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    const oldToken = this.config.serverToken;
    const newToken = generateToken(64);

    // Decrypt all passwords with old token and re-encrypt with new token
    for (const connection of Object.values(this.config.connections)) {
      try {
        const encryptedData: EncryptedData = JSON.parse(connection.password);
        const plainPassword = decryptPassword(encryptedData, oldToken);
        const newEncryptedData = encryptPassword(plainPassword, newToken);
        connection.password = JSON.stringify(newEncryptedData);
      } catch (error) {
        throw new Error(
          `Failed to rotate token for connection ${connection.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    this.config.serverToken = newToken;
    await this.saveConfig();
    return newToken;
  }
}

// Singleton instance
let configManagerInstance: ConfigManager | null = null;

/**
 * Get or create the config manager singleton
 */
export function getConfigManager(configPath?: string): ConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager(configPath);
  }
  return configManagerInstance;
}
