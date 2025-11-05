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
import { getSessionManager } from './session-manager.js';

export class McpHandlers {
  private queryExecutor = getQueryExecutor();
  private dbManager = getDatabaseManager();
  private databaseDiscovery = getDatabaseDiscovery();
  private connectionManager = getConnectionManager();
  private sessionManager = getSessionManager();
  private currentApiKeyId: string | null = null;
  private currentSessionId: string | null = null;
  private transportMode: 'stdio' | 'http' = 'stdio';

  /**
   * Set the current API key ID for logging
   */
  setApiKeyId(apiKeyId: string | null): void {
    this.currentApiKeyId = apiKeyId;
  }

  /**
   * Set the current session ID and transport mode
   */
  setSession(sessionId: string | null, mode: 'stdio' | 'http'): void {
    this.currentSessionId = sessionId;
    this.transportMode = mode;
  }

  /**
   * Get active connection ID based on transport mode
   * - stdio mode: uses ConnectionManager (process-level state)
   * - HTTP mode: uses SessionManager (session-level state)
   */
  private getActiveConnectionId(): string | null {
    if (this.transportMode === 'http' && this.currentSessionId) {
      return this.sessionManager.getActiveConnection(this.currentSessionId);
    } else {
      return this.connectionManager.getActiveConnectionId();
    }
  }

  /**
   * Set active connection ID based on transport mode
   */
  private setActiveConnectionId(connectionId: string): void {
    if (this.transportMode === 'http' && this.currentSessionId) {
      this.sessionManager.setActiveConnection(this.currentSessionId, connectionId);
    } else {
      this.connectionManager.setActiveConnectionId(connectionId);
    }
  }

  /**
   * Get active database based on transport mode
   */
  private getActiveDatabase(connectionId?: string): string | null {
    if (this.transportMode === 'http' && this.currentSessionId) {
      return this.sessionManager.getActiveDatabase(this.currentSessionId, connectionId);
    } else {
      return this.connectionManager.getActiveDatabase(connectionId);
    }
  }

  /**
   * Set active database based on transport mode
   */
  private setActiveDatabase(connectionId: string, database: string): void {
    if (this.transportMode === 'http' && this.currentSessionId) {
      this.sessionManager.setActiveDatabase(this.currentSessionId, connectionId, database);
    } else {
      this.connectionManager.setActiveDatabase(connectionId, database);
    }
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
      // Get active connection (dual-mode: stdio or HTTP session)
      const connectionId = this.getActiveConnectionId();
      if (!connectionId) {
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

      const connection = this.dbManager.getConnection(connectionId);
      if (!connection) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Active connection not found',
            },
          ],
          isError: true,
        };
      }

      // Get active database (dual-mode: stdio or HTTP session)
      const activeDatabase = this.getActiveDatabase(connectionId);

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
              isActive: activeDatabase === metadata.name,
              permissions: connection.databases[metadata.name].permissions,
              tableCount: metadata.tableCount,
              size: metadata.sizeFormatted,
            });
          } catch (error) {
            // If metadata fails, just include basic info
            databases.push({
              name: dbName,
              isActive: activeDatabase === dbName,
              permissions: connection.databases[dbName].permissions,
            });
          }
        }
      } else {
        // Just return basic info
        for (const dbName of databaseNames) {
          databases.push({
            name: dbName,
            isActive: activeDatabase === dbName,
            permissions: connection.databases[dbName].permissions,
          });
        }
      }

      const resultText = this.formatDatabaseList(connection.name, databases, activeDatabase || undefined);

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
      // Get active connection (dual-mode: stdio or HTTP session)
      const connectionId = this.getActiveConnectionId();
      if (!connectionId) {
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

      const connection = this.dbManager.getConnection(connectionId);
      if (!connection) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Active connection not found',
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

      const previousDatabase = this.getActiveDatabase(connectionId);

      // Switch database (dual-mode: stdio process or HTTP session)
      this.setActiveDatabase(connectionId, database);

      const newPermissions = connection.databases[database].permissions;

      const resultText = this.formatSwitchResult(previousDatabase || undefined, database, newPermissions);

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
