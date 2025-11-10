import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default database path (in project root /data directory)
// Can be overridden with DB_PATH environment variable
const DEFAULT_DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../../../data/mysql-mcp.db');

/**
 * Database schema definition
 */
export const SCHEMA = `
-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  is_active INTEGER DEFAULT 1,
  must_change_password INTEGER DEFAULT 0
);

-- API Keys Table
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  is_active INTEGER DEFAULT 1
);

-- Connections Table
CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  user TEXT NOT NULL,
  password TEXT NOT NULL,
  is_active INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Databases Table
CREATE TABLE IF NOT EXISTS databases (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  name TEXT NOT NULL,
  alias TEXT,
  is_active INTEGER DEFAULT 0,
  is_enabled INTEGER DEFAULT 1,
  last_accessed INTEGER DEFAULT 0,
  select_perm INTEGER DEFAULT 1,
  insert_perm INTEGER DEFAULT 0,
  update_perm INTEGER DEFAULT 0,
  delete_perm INTEGER DEFAULT 0,
  create_perm INTEGER DEFAULT 0,
  alter_perm INTEGER DEFAULT 0,
  drop_perm INTEGER DEFAULT 0,
  truncate_perm INTEGER DEFAULT 0,
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
);

-- Request Logs Table
CREATE TABLE IF NOT EXISTS request_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key_id TEXT,
  user_id TEXT,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  request_body TEXT,
  response_body TEXT,
  status_code INTEGER,
  duration_ms INTEGER,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Settings Table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_connections_is_active ON connections(is_active);
CREATE INDEX IF NOT EXISTS idx_databases_connection_id ON databases(connection_id);
CREATE INDEX IF NOT EXISTS idx_databases_is_active ON databases(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_databases_unique_name ON databases(connection_id, name);
CREATE INDEX IF NOT EXISTS idx_request_logs_api_key_id ON request_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_user_id ON request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp);
-- Note: idx_databases_is_enabled, idx_databases_unique_alias, and idx_databases_last_accessed are created by migration after adding their respective columns
`;

/**
 * Run database migrations
 */
function runMigrations(db: Database.Database): void {
  // Check if is_enabled column exists in databases table
  const tableInfo = db.pragma('table_info(databases)') as Array<{ name: string }>;
  const hasIsEnabled = tableInfo.some((col) => col.name === 'is_enabled');

  if (!hasIsEnabled) {
    // Add is_enabled column to existing databases table
    db.exec('ALTER TABLE databases ADD COLUMN is_enabled INTEGER DEFAULT 1');
    // Create index for the new column
    db.exec('CREATE INDEX IF NOT EXISTS idx_databases_is_enabled ON databases(is_enabled)');
    console.log('Migration: Added is_enabled column to databases table');
  }

  // Always ensure existing databases with NULL are set to enabled (backward compatibility)
  // This handles cases where the column exists but rows have NULL values from the ALTER TABLE
  // Note: We only update NULL, not 0, because 0 means the user intentionally disabled it
  const updateStmt = db.prepare('UPDATE databases SET is_enabled = 1 WHERE is_enabled IS NULL');
  const result = updateStmt.run();
  if (result.changes > 0) {
    console.log(`Migration: Enabled ${result.changes} existing database(s) that had NULL is_enabled`);
  }

  // Create unique index to prevent duplicate databases
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_databases_unique_name ON databases(connection_id, name)');

  // Initialize mcp_enabled setting if not exists
  const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  stmt.run('mcp_enabled', 'true');

  // v4.0.0 Migration: Add alias and last_accessed columns
  const hasAlias = tableInfo.some((col) => col.name === 'alias');
  const hasLastAccessed = tableInfo.some((col) => col.name === 'last_accessed');

  if (!hasAlias) {
    db.exec('ALTER TABLE databases ADD COLUMN alias TEXT');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_databases_unique_alias ON databases(alias)');
    console.log('Migration v4.0.0: Added alias column to databases table');
  }

  if (!hasLastAccessed) {
    db.exec('ALTER TABLE databases ADD COLUMN last_accessed INTEGER DEFAULT 0');
    db.exec('CREATE INDEX IF NOT EXISTS idx_databases_last_accessed ON databases(last_accessed)');
    console.log('Migration v4.0.0: Added last_accessed column to databases table');
  }

  // Generate unique aliases for existing databases (only if alias is NULL)
  const aliasGenStmt = db.prepare('SELECT id, connection_id, name, alias FROM databases WHERE alias IS NULL');
  const dbsNeedingAlias = aliasGenStmt.all() as Array<{ id: string; connection_id: string; name: string; alias: string | null }>;

  if (dbsNeedingAlias.length > 0) {
    console.log(`Migration v4.0.0: Generating aliases for ${dbsNeedingAlias.length} database(s)`);

    const existingAliases = new Set<string>();
    const getExistingAliases = db.prepare('SELECT alias FROM databases WHERE alias IS NOT NULL');
    const existing = getExistingAliases.all() as Array<{ alias: string }>;
    existing.forEach((row) => existingAliases.add(row.alias));

    const updateAliasStmt = db.prepare('UPDATE databases SET alias = ? WHERE id = ?');

    for (const dbRow of dbsNeedingAlias) {
      let alias = dbRow.name;
      let counter = 2;

      // Generate unique alias
      while (existingAliases.has(alias)) {
        alias = `${dbRow.name}_${counter}`;
        counter++;
      }

      updateAliasStmt.run(alias, dbRow.id);
      existingAliases.add(alias);
    }

    console.log('Migration v4.0.0: Generated unique aliases for all databases');
  }

  // Initialize default settings for v4.0.0
  const settingsStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  settingsStmt.run('maxActiveDatabases', '10');
  settingsStmt.run('maxActiveConnections', '5');
  settingsStmt.run('currentDatabaseAlias', '');

  // Migrate defaultConnection to currentDatabaseAlias if it exists
  const defaultConnStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const defaultConn = defaultConnStmt.get('defaultConnection') as { value: string } | undefined;

  if (defaultConn && defaultConn.value) {
    // Get the active database for the default connection
    const activeDbStmt = db.prepare('SELECT alias FROM databases WHERE connection_id = ? AND is_active = 1 LIMIT 1');
    const activeDb = activeDbStmt.get(defaultConn.value) as { alias: string } | undefined;

    if (activeDb && activeDb.alias) {
      const updateCurrentStmt = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
      updateCurrentStmt.run(activeDb.alias, 'currentDatabaseAlias');
      console.log(`Migration v4.0.0: Set current database to ${activeDb.alias}`);
    }
  }
}

/**
 * Initialize database with schema
 */
export function initDatabase(dbPath: string = DEFAULT_DB_PATH): Database.Database {
  // Ensure data directory exists
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Create/open database
  const db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Set busy timeout to 5 seconds for handling concurrent writes
  db.pragma('busy_timeout = 5000');

  // Execute schema
  db.exec(SCHEMA);

  // Run migrations
  runMigrations(db);

  return db;
}

/**
 * Get database instance (singleton)
 */
let dbInstance: Database.Database | null = null;

export function getDatabase(dbPath?: string): Database.Database {
  if (!dbInstance) {
    dbInstance = initDatabase(dbPath);
  }
  return dbInstance;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
