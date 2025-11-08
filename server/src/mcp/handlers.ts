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
import { sanitizeForLogging } from '../utils/sanitize.js';

export class McpHandlers {
  private queryExecutor = getQueryExecutor();
  private dbManager = getDatabaseManager();
  private databaseDiscovery = getDatabaseDiscovery();
  private connectionManager = getConnectionManager();
  private sessionManager = getSessionManager();
  private currentApiKeyId: string | null = null;
  private currentSessionId: string | null = null;
  private transportMode: 'stdio' | 'http' = 'stdio';
  private isAuthenticated: boolean = true; // Default to true for HTTP mode
  private authErrorType: string | null = null;

  /**
   * Set the current API key ID for logging
   */
  setApiKeyId(apiKeyId: string | null): void {
    this.currentApiKeyId = apiKeyId;
  }

  /**
   * Set authentication state (for stdio mode)
   */
  setAuthenticationState(isValid: boolean, errorType: string | null): void {
    this.isAuthenticated = isValid;
    this.authErrorType = errorType;
  }

  /**
   * Set the current session ID and transport mode
   */
  setSession(sessionId: string | null, mode: 'stdio' | 'http'): void {
    this.currentSessionId = sessionId;
    this.transportMode = mode;
  }

  /**
   * Get authentication setup error message
   */
  private getAuthSetupMessage(): string {
    const errorPrefix = this.authErrorType === 'Missing AUTH_TOKEN'
      ? '🔒 **Authentication Required: Missing AUTH_TOKEN**'
      : '🔒 **Authentication Failed: Invalid AUTH_TOKEN**';

    return `${errorPrefix}

To use MySQL MCP WebUI with Claude Desktop, you need to set up authentication:

**STEP 1: Generate an API Token**

Run this command in your terminal:
\`\`\`bash
mysql-mcp-webui --generate-token
\`\`\`

This will output a token like:
\`\`\`
mcp_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
\`\`\`

**STEP 2: Update Claude Desktop Configuration**

Add the token to your Claude Desktop config file:

**macOS:** ~/Library/Application Support/Claude/claude_desktop_config.json
**Windows:** %APPDATA%\\Claude\\claude_desktop_config.json

\`\`\`json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "mysql-mcp-webui"],
      "env": {
        "TRANSPORT": "stdio",
        "AUTH_TOKEN": "paste-your-token-here"
      }
    }
  }
}
\`\`\`

**STEP 3: Restart Claude Desktop**

1. Save the config file
2. Completely quit and restart Claude Desktop
3. The Web UI will be available at http://localhost:9274

**STEP 4: Configure MySQL Connection**

Open http://localhost:9274 in your browser to:
- Login (default: admin/admin)
- Add your MySQL connection details
- Set database permissions
- Test the connection

Once configured, you'll be able to query your databases through Claude!

---
*Need help? Visit: https://github.com/yashagldit/mysql-mcp-webui*`;
  }

  /**
   * Check if authenticated and return error result if not
   */
  private checkAuthentication(): CallToolResult | null {
    if (!this.isAuthenticated) {
      return {
        content: [
          {
            type: 'text',
            text: this.getAuthSetupMessage(),
          },
        ],
        isError: true,
      };
    }
    return null;
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
      // Check authentication first
      const authError = this.checkAuthentication();
      if (authError) {
        return authError;
      }

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

        // Security: Sanitize request and response data before logging
        this.dbManager.logRequest(
          this.currentApiKeyId,
          `/mcp/${name}`,
          'TOOL_CALL',
          sanitizeForLogging({ tool: name, arguments: args }),
          sanitizeForLogging(result),
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
      // Pass session context to query executor
      this.queryExecutor.setSession(this.currentSessionId, this.transportMode);

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
              text: 'Error: No active connection configured. Please visit http://localhost:9274 to add a database connection.',
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

      // Filter out disabled databases (only show enabled ones via MCP)
      const databaseNames = Object.keys(connection.databases).filter(
        (dbName) => connection.databases[dbName].isEnabled
      );
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
              text: 'Error: No active connection configured. Please visit http://localhost:9274 to add a database connection.',
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

      // Check if database is enabled
      if (!connection.databases[database].isEnabled) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Database '${database}' is disabled and not accessible via MCP`,
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
