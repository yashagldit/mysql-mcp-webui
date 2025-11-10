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
import { getMasterKey } from '../config/master-key.js';
import { AddConnectionRequestSchema } from '../types/index.js';
import type { AddConnectionRequest } from '../types/index.js';

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
   * Activate a database by alias (dual-mode: stdio or HTTP session)
   */
  private async activateDatabase(alias: string): Promise<void> {
    if (this.transportMode === 'http' && this.currentSessionId) {
      this.sessionManager.activateDatabase(this.currentSessionId, alias);
    } else {
      await this.connectionManager.activateDatabase(alias);
    }
  }

  /**
   * Set current database by alias (dual-mode: stdio or HTTP session)
   */
  private setCurrentDatabase(alias: string): void {
    if (this.transportMode === 'http' && this.currentSessionId) {
      this.sessionManager.setCurrentDatabase(this.currentSessionId, alias);
    } else {
      this.connectionManager.setCurrentDatabase(alias);
    }
  }

  /**
   * Get current database (dual-mode: stdio or HTTP session)
   */
  private getCurrentDatabase(): any | null {
    if (this.transportMode === 'http' && this.currentSessionId) {
      return this.sessionManager.getCurrentDatabase(this.currentSessionId);
    } else {
      return this.connectionManager.getCurrentDatabase();
    }
  }

  /**
   * Get all active databases (dual-mode: stdio or HTTP session)
   */
  private getActiveDatabases(): any[] {
    if (this.transportMode === 'http' && this.currentSessionId) {
      return this.sessionManager.getActiveDatabases(this.currentSessionId);
    } else {
      return this.connectionManager.getActiveDatabases();
    }
  }

  // ============================================================================
  // Legacy methods (deprecated but kept for compatibility)
  // ============================================================================

  /**
   * @deprecated Use getCurrentDatabase() instead
   */
  private getActiveConnectionId(): string | null {
    const current = this.getCurrentDatabase();
    return current?.connectionId || null;
  }

  /**
   * @deprecated Use setCurrentDatabase() instead
   */
  private setActiveConnectionId(_connectionId: string): void {
    // No-op, kept for compatibility
  }

  /**
   * @deprecated Use getCurrentDatabase() instead
   */
  private getActiveDatabase(_connectionId?: string): string | null {
    const current = this.getCurrentDatabase();
    return current?.database || null;
  }

  /**
   * @deprecated Use setCurrentDatabase() and activateDatabase() instead
   */
  private setActiveDatabase(_connectionId: string, _database: string): void {
    // No-op, kept for compatibility
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

        case 'add_connection':
          result = await this.handleAddConnection(args);
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
    const { database: alias, sql } = args as { database: string; sql: string };

    if (!alias) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: database parameter is required (use the database alias from list_databases)',
          },
        ],
        isError: true,
      };
    }

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
      // Get database context by alias
      const dbContext = this.dbManager.getDatabaseByAlias(alias);
      if (!dbContext) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Database with alias '${alias}' not found. Use list_databases to see available databases.`,
            },
          ],
          isError: true,
        };
      }

      // Auto-activate the database
      await this.activateDatabase(alias);

      // Execute query with explicit connection and database
      const result = await this.queryExecutor.executeQuery(sql, dbContext.connectionId, dbContext.database);

      // Format result as text
      const resultText = this.formatQueryResult(result, dbContext);

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
      // Get all databases with their status
      const allDatabases = this.dbManager.getAllDatabasesWithStatus();

      if (allDatabases.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No databases configured. Please visit http://localhost:9274 to add a MySQL connection and discover databases.',
            },
          ],
        };
      }

      // Get current and active databases from session/process state
      const currentDb = this.getCurrentDatabase();
      const activeDbs = this.getActiveDatabases();
      const activeAliases = new Set(activeDbs.map((db: any) => db.alias));

      // Group databases by connection
      const grouped: Record<string, any[]> = {};

      for (const db of allDatabases) {
        // Skip disabled databases
        if (!db.isEnabled) continue;

        // Skip databases from disabled connections
        const connection = this.dbManager.getConnection(db.connectionId);
        if (!connection || !connection.isEnabled) continue;

        if (!grouped[db.connectionName]) {
          grouped[db.connectionName] = [];
        }

        const dbInfo: any = {
          alias: db.alias,
          name: db.database,
          isActive: activeAliases.has(db.alias),
          isCurrent: currentDb?.alias === db.alias,
          permissions: db.permissions,
        };

        // Add metadata if requested
        if (include_metadata) {
          try {
            const pool = await this.connectionManager.getPool(db.connectionId);
            const metadata = await this.databaseDiscovery.getDatabaseMetadata(pool, db.database);
            dbInfo.tableCount = metadata.tableCount;
            dbInfo.size = metadata.sizeFormatted;
          } catch (error) {
            // Metadata fetch failed, skip it
          }
        }

        grouped[db.connectionName].push(dbInfo);
      }

      const resultText = this.formatDatabaseListGrouped(grouped, currentDb?.alias);

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
    const { database: alias } = args as { database: string };

    if (!alias) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: database parameter is required (use the database alias from list_databases)',
          },
        ],
        isError: true,
      };
    }

    try {
      // Get database context by alias
      const dbContext = this.dbManager.getDatabaseByAlias(alias);
      if (!dbContext) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Database with alias '${alias}' not found. Use list_databases to see available databases.`,
            },
          ],
          isError: true,
        };
      }

      // Get database config for permissions
      const dbConfig = this.dbManager.getDatabaseConfig(dbContext.connectionId, dbContext.database);
      if (!dbConfig) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Database configuration not found for '${alias}'`,
            },
          ],
          isError: true,
        };
      }

      // Check if database is enabled
      if (!dbConfig.isEnabled) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Database '${alias}' is disabled and not accessible via MCP`,
            },
          ],
          isError: true,
        };
      }

      // Check if connection is enabled
      const connection = this.dbManager.getConnection(dbContext.connectionId);
      if (!connection || !connection.isEnabled) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Connection for database '${alias}' is disabled and not accessible via MCP`,
            },
          ],
          isError: true,
        };
      }

      // Get previous current database
      const previousDb = this.getCurrentDatabase();

      // Activate and set as current (dual-mode: stdio or HTTP session)
      await this.activateDatabase(alias);
      this.setCurrentDatabase(alias);

      const resultText = this.formatSwitchResult(
        previousDb?.alias,
        alias,
        dbContext.database,
        dbContext.connectionName,
        dbConfig.permissions
      );

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
   * Handle add_connection tool call
   */
  private async handleAddConnection(args: unknown): Promise<CallToolResult> {
    // Validate parameters
    const validation = AddConnectionRequestSchema.safeParse(args);
    if (!validation.success) {
      const errors = validation.error.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
      return {
        content: [
          {
            type: 'text',
            text: `Error: Invalid parameters\n\n${errors}`,
          },
        ],
        isError: true,
      };
    }

    const request = validation.data as AddConnectionRequest;

    try {
      // Test connection first before saving
      const testResult = await this.connectionManager.testConnection(
        {
          id: 'test',
          name: request.name,
          host: request.host,
          port: request.port,
          user: request.user,
          password: '', // Empty password in config
          isActive: false,
          isEnabled: true,
          databases: {},
        },
        request.password // Actual password passed separately
      );

      // Get master key for encryption
      const masterKey = getMasterKey();

      // Add connection with discovered databases
      const connectionId = this.dbManager.addConnection(
        request,
        masterKey,
        testResult.databases
      );

      // Format success response
      const lines = [
        `✅ Successfully added connection '${request.name}'`,
        '',
        `Connection ID: ${connectionId}`,
        `Host: ${request.host}:${request.port}`,
        `User: ${request.user}`,
        '',
        `Discovered ${testResult.databases.length} database(s):`,
        ...testResult.databases.map(db => `  • ${db}`),
        '',
        'All databases have been added with default SELECT permissions.',
        '',
        '💡 Use list_databases to see all available databases with their aliases.',
      ];

      return {
        content: [
          {
            type: 'text',
            text: lines.join('\n'),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to add connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Format query result as readable text
   */
  private formatQueryResult(result: { rows: unknown[]; fields: string[]; rowCount: number; executionTime: string }, dbContext: any): string {
    const lines: string[] = [];

    lines.push(`Query executed successfully on '${dbContext.alias}' (${dbContext.database} @ ${dbContext.connectionName})`);
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
   * Format database list grouped by connection as readable text
   */
  private formatDatabaseListGrouped(grouped: Record<string, any[]>, currentAlias?: string): string {
    const lines: string[] = [];

    lines.push('Available Databases');
    lines.push('==================');
    lines.push('');

    if (currentAlias) {
      lines.push(`Current database: ${currentAlias} ⭐`);
      lines.push('');
    }

    for (const [connectionName, databases] of Object.entries(grouped)) {
      lines.push(`Connection: ${connectionName}`);
      lines.push('-'.repeat(50));

      for (const db of databases) {
        const markers = [];
        if (db.isCurrent) markers.push('⭐ CURRENT');
        if (db.isActive) markers.push('🔵 ACTIVE');

        const statusText = markers.length > 0 ? ` [${markers.join(', ')}]` : '';

        lines.push(`  • Alias: ${db.alias}${statusText}`);
        lines.push(`    Name: ${db.name}`);

        if (db.tableCount !== undefined) {
          lines.push(`    Tables: ${db.tableCount}`);
        }
        if (db.size !== undefined) {
          lines.push(`    Size: ${db.size}`);
        }

        lines.push(`    Permissions: ${JSON.stringify(db.permissions)}`);
        lines.push('');
      }
    }

    lines.push('');
    lines.push('💡 Use the alias (not the database name) in mysql_query and switch_database');

    return lines.join('\n');
  }

  /**
   * Format database switch result as readable text
   */
  private formatSwitchResult(
    previousAlias: string | undefined,
    newAlias: string,
    databaseName: string,
    connectionName: string,
    permissions: unknown
  ): string {
    const lines: string[] = [];

    lines.push(`✅ Successfully switched to database '${newAlias}'`);
    lines.push('');
    lines.push(`Previous: ${previousAlias || 'none'}`);
    lines.push(`Current: ${newAlias}`);
    lines.push(`Database: ${databaseName}`);
    lines.push(`Connection: ${connectionName}`);
    lines.push('');
    lines.push('Permissions:');
    lines.push(JSON.stringify(permissions, null, 2));

    return lines.join('\n');
  }
}
