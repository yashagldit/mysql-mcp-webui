import type {
  CallToolRequest,
  CallToolResult,
  ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js';
import { getAllTools } from './tools.js';
import { getQueryExecutor } from '../db/query-executor.js';
import { getDatabaseManager } from '../db/database-manager.js';
import { getDatabaseDiscovery } from '../db/discovery.js';
import { getConnectionManager } from '../db/connection-manager.js';

export class McpHandlers {
  private queryExecutor = getQueryExecutor();
  private dbManager = getDatabaseManager();
  private databaseDiscovery = getDatabaseDiscovery();
  private connectionManager = getConnectionManager();
  private currentApiKeyId: string | null = null;

  /**
   * Set the current API key ID for logging
   */
  setApiKeyId(apiKeyId: string | null): void {
    this.currentApiKeyId = apiKeyId;
  }

  /**
   * Handle ListTools request
   */
  async handleListTools(): Promise<ListToolsResult> {
    return {
      tools: getAllTools(),
    };
  }

  /**
   * Handle CallTool request
   */
  async handleCallTool(request: CallToolRequest): Promise<CallToolResult> {
    const { name, arguments: args } = request.params;
    const startTime = Date.now();

    try {
      let result: CallToolResult;

      switch (name) {
        case 'mysql_query':
          result = await this.handleMysqlQuery(args);
          break;

        case 'list_databases':
          result = await this.handleListDatabases(args);
          break;

        case 'switch_database':
          result = await this.handleSwitchDatabase(args);
          break;

        default:
          result = {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }

      // Log the MCP tool call
      if (this.currentApiKeyId) {
        const duration = Date.now() - startTime;
        const statusCode = result.isError ? 400 : 200;

        this.dbManager.logRequest(
          this.currentApiKeyId,
          `/mcp/${name}`,
          'TOOL_CALL',
          { tool: name, arguments: args },
          result,
          statusCode,
          duration
        );
      }

      return result;
    } catch (error) {
      const errorResult: CallToolResult = {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };

      // Log the error
      if (this.currentApiKeyId) {
        const duration = Date.now() - startTime;

        this.dbManager.logRequest(
          this.currentApiKeyId,
          `/mcp/${name}`,
          'TOOL_CALL',
          { tool: name, arguments: args },
          errorResult,
          500,
          duration
        );
      }

      return errorResult;
    }
  }

  /**
   * Handle mysql_query tool call
   */
  private async handleMysqlQuery(args: unknown): Promise<CallToolResult> {
    const { sql } = args as { sql: string };

    if (!sql) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: sql parameter is required',
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await this.queryExecutor.executeQuery(sql);

      // Format result as text
      const resultText = this.formatQueryResult(result);

      return {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle list_databases tool call
   */
  private async handleListDatabases(args: unknown): Promise<CallToolResult> {
    const { include_metadata = false } = (args as { include_metadata?: boolean }) || {};

    try {
      const connection = this.dbManager.getActiveConnection();

      if (!connection) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: No active connection configured',
            },
          ],
          isError: true,
        };
      }

      const databaseNames = Object.keys(connection.databases);
      const databases = [];

      if (include_metadata) {
        // Get metadata for each database
        const pool = await this.connectionManager.getPool(connection.id);

        for (const dbName of databaseNames) {
          try {
            const metadata = await this.databaseDiscovery.getDatabaseMetadata(pool, dbName);
            databases.push({
              name: metadata.name,
              isActive: connection.activeDatabase === metadata.name,
              permissions: connection.databases[metadata.name].permissions,
              tableCount: metadata.tableCount,
              size: metadata.sizeFormatted,
            });
          } catch (error) {
            // If metadata fails, just include basic info
            databases.push({
              name: dbName,
              isActive: connection.activeDatabase === dbName,
              permissions: connection.databases[dbName].permissions,
            });
          }
        }
      } else {
        // Just return basic info
        for (const dbName of databaseNames) {
          databases.push({
            name: dbName,
            isActive: connection.activeDatabase === dbName,
            permissions: connection.databases[dbName].permissions,
          });
        }
      }

      const resultText = this.formatDatabaseList(connection.name, databases, connection.activeDatabase);

      return {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list databases: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle switch_database tool call
   */
  private async handleSwitchDatabase(args: unknown): Promise<CallToolResult> {
    const { database } = args as { database: string };

    if (!database) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: database parameter is required',
          },
        ],
        isError: true,
      };
    }

    try {
      const connection = this.dbManager.getActiveConnection();

      if (!connection) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: No active connection configured',
            },
          ],
          isError: true,
        };
      }

      if (!connection.databases[database]) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Database '${database}' not found in connection '${connection.name}'`,
            },
          ],
          isError: true,
        };
      }

      const previousDatabase = connection.activeDatabase;

      // Switch database
      this.dbManager.switchDatabase(connection.id, database);

      const newPermissions = connection.databases[database].permissions;

      const resultText = this.formatSwitchResult(previousDatabase, database, newPermissions);

      return {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to switch database: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Format query result as readable text
   */
  private formatQueryResult(result: { rows: unknown[]; fields: string[]; rowCount: number; executionTime: string }): string {
    const lines: string[] = [];

    lines.push(`Query executed successfully`);
    lines.push(`Rows: ${result.rowCount}`);
    lines.push(`Execution time: ${result.executionTime}`);
    lines.push('');

    if (result.rows.length > 0) {
      lines.push('Results:');
      lines.push(JSON.stringify(result.rows, null, 2));
    } else {
      lines.push('No rows returned');
    }

    return lines.join('\n');
  }

  /**
   * Format database list as readable text
   */
  private formatDatabaseList(connectionName: string, databases: unknown[], activeDatabase?: string): string {
    const lines: string[] = [];

    lines.push(`Databases for connection: ${connectionName}`);
    lines.push(`Active database: ${activeDatabase || 'none'}`);
    lines.push('');
    lines.push(JSON.stringify(databases, null, 2));

    return lines.join('\n');
  }

  /**
   * Format database switch result as readable text
   */
  private formatSwitchResult(previousDatabase: string | undefined, newDatabase: string, permissions: unknown): string {
    const lines: string[] = [];

    lines.push(`Successfully switched database`);
    lines.push(`Previous: ${previousDatabase || 'none'}`);
    lines.push(`Current: ${newDatabase}`);
    lines.push('');
    lines.push('Permissions:');
    lines.push(JSON.stringify(permissions, null, 2));

    return lines.join('\n');
  }
}
