import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Tool: mysql_query
 * Execute SQL query against the active database
 */
export const mysqlQueryTool: Tool = {
  name: 'mysql_query',
  description: `Execute a SQL query against the active MySQL database.

The query will be validated against the configured permissions for the active database before execution.

Available permissions:
- SELECT: Read data from tables
- INSERT: Insert new data into tables
- UPDATE: Update existing data in tables
- DELETE: Delete data from tables
- CREATE: Create new database objects (tables, indexes, etc.)
- ALTER: Modify existing database structure
- DROP: Drop database objects
- TRUNCATE: Truncate tables

The query runs within a transaction and will be rolled back if it fails.`,
  inputSchema: {
    type: 'object',
    properties: {
      sql: {
        type: 'string',
        description: 'The SQL query to execute',
      },
    },
    required: ['sql'],
  },
};

/**
 * MCP Tool: list_databases
 * List all available databases from the active connection
 */
export const listDatabasesTool: Tool = {
  name: 'list_databases',
  description: `List all available databases from the active MySQL connection.

Returns information about each database including:
- Database name
- Active status (currently selected database)
- Configured permissions for each operation
- Optionally: table count and database size (if include_metadata is true)

This tool helps you see which databases are available and what operations are permitted on each.`,
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
 * Switch to a different database in the active connection
 */
export const switchDatabaseTool: Tool = {
  name: 'switch_database',
  description: `Switch to a different database within the active MySQL connection.

This changes the active database for all subsequent queries. The switch is persisted to the configuration file.

After switching, you'll receive:
- Confirmation of the switch
- The previous database name
- The new active database name
- Permissions configured for the new database

All future mysql_query calls will execute against the newly selected database until you switch again.`,
  inputSchema: {
    type: 'object',
    properties: {
      database: {
        type: 'string',
        description: 'Name of the database to switch to',
      },
    },
    required: ['database'],
  },
};

/**
 * Get all MCP tools
 */
export function getAllTools(): Tool[] {
  return [mysqlQueryTool, listDatabasesTool, switchDatabaseTool];
}
