import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Tool: mysql_query
 * Execute SQL query against a specified database
 */
export const mysqlQueryTool: Tool = {
  name: 'mysql_query',
  description: `Execute a SQL query against a MySQL database.

The query will be validated against the configured permissions for the database before execution.

Available permissions:
- SELECT: Read data from tables
- INSERT: Insert new data into tables
- UPDATE: Update existing data in tables
- DELETE: Delete data from tables
- CREATE: Create new database objects (tables, indexes, etc.)
- ALTER: Modify existing database structure
- DROP: Drop database objects
- TRUNCATE: Truncate tables

The query runs within a transaction and will be rolled back if it fails.

The database will be automatically activated if not already active. Use the alias (not the actual database name) to specify the database.`,
  inputSchema: {
    type: 'object',
    properties: {
      database: {
        type: 'string',
        description: 'The database alias to execute the query against (use list_databases to see available aliases)',
      },
      sql: {
        type: 'string',
        description: 'The SQL query to execute',
      },
    },
    required: ['database', 'sql'],
  },
};

/**
 * MCP Tool: list_databases
 * List all available databases across all connections
 */
export const listDatabasesTool: Tool = {
  name: 'list_databases',
  description: `List all available databases across all MySQL connections.

Returns information about each database including:
- Database alias (use this in mysql_query and switch_database)
- Actual database name
- Connection name
- Active status (currently in use)
- Current status (the default/selected database)
- Configured permissions for each operation
- Optionally: table count and database size (if include_metadata is true)

Databases are grouped by connection for better readability. Use the alias (not the database name) when calling other tools.`,
  inputSchema: {
    type: 'object',
    properties: {
      include_metadata: {
        type: 'boolean',
        description: 'Include additional metadata like table count and size (default: false)',
        default: false,
      },
    },
  },
};

/**
 * MCP Tool: switch_database
 * Switch to a different database (sets as current/default)
 */
export const switchDatabaseTool: Tool = {
  name: 'switch_database',
  description: `Switch to a different database, making it the current/default database.

This sets the database as the current context and activates it for use. The database will be automatically activated if not already active.

After switching, you'll receive:
- Confirmation of the switch
- The database alias
- The actual database name
- Connection name
- Permissions configured for the database

Use the database alias (not the actual database name) to specify which database to switch to. Use list_databases to see available aliases.`,
  inputSchema: {
    type: 'object',
    properties: {
      database: {
        type: 'string',
        description: 'Alias of the database to switch to (use list_databases to see available aliases)',
      },
    },
    required: ['database'],
  },
};

/**
 * MCP Tool: add_connection
 * Add a new MySQL connection
 */
export const addConnectionTool: Tool = {
  name: 'add_connection',
  description: `Add a new MySQL connection to the server.

This tool allows you to create a new MySQL connection with the provided credentials.
The connection will be tested before being saved to ensure it's valid.

The password will be encrypted at rest using AES-256-GCM encryption.

After adding, databases will be automatically discovered from the MySQL server and added with default SELECT permissions.

Returns the connection ID and list of discovered databases.`,
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Display name for the connection (e.g., "Production DB", "Local MySQL")',
      },
      host: {
        type: 'string',
        description: 'MySQL host address (e.g., "localhost", "192.168.1.100", "mysql.example.com")',
      },
      port: {
        type: 'number',
        description: 'MySQL port number (default: 3306)',
        default: 3306,
      },
      user: {
        type: 'string',
        description: 'MySQL username',
      },
      password: {
        type: 'string',
        description: 'MySQL password (will be encrypted at rest)',
      },
    },
    required: ['name', 'host', 'port', 'user', 'password'],
  },
};

/**
 * Get all MCP tools
 */
export function getAllTools(): Tool[] {
  return [mysqlQueryTool, listDatabasesTool, switchDatabaseTool, addConnectionTool];
}
