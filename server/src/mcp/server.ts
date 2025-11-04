import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { McpHandlers } from './handlers.js';
import { getConfigManager } from '../config/manager.js';
import { constantTimeCompare } from '../config/crypto.js';

export class McpServer {
  private server: Server;
  private handlers: McpHandlers;
  private configManager = getConfigManager();

  constructor() {
    this.server = new Server(
      {
        name: 'mysql-mcp-webui',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.handlers = new McpHandlers();
    this.setupHandlers();
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // List Tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return await this.handlers.handleListTools();
    });

    // Call Tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await this.handlers.handleCallTool(request);
    });
  }

  /**
   * Verify authentication token
   */
  private verifyToken(token?: string): boolean {
    const config = this.configManager.getConfig();

    if (!token) {
      return false;
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;

    return constantTimeCompare(cleanToken, config.serverToken);
  }

  /**
   * Start MCP server with stdio transport
   */
  async startStdio(): Promise<void> {
    // Verify AUTH_TOKEN environment variable
    const authToken = process.env.AUTH_TOKEN;

    if (!authToken) {
      throw new Error('AUTH_TOKEN environment variable is required for stdio mode');
    }

    if (!this.verifyToken(authToken)) {
      throw new Error('Invalid AUTH_TOKEN provided');
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('MCP Server running on stdio transport');
  }

  /**
   * Get the Express middleware for HTTP transport
   * This returns a function that can be used as Express middleware
   */
  getHttpHandler(): (req: unknown, res: unknown) => Promise<void> {
    return async (req: any, res: any) => {
      try {
        // Verify authentication
        const authHeader = req.headers.authorization;

        if (!this.verifyToken(authHeader)) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }

        // Extract request body
        const requestBody = req.body;

        if (!requestBody || !requestBody.method) {
          res.status(400).json({ error: 'Invalid MCP request' });
          return;
        }

        // Route to appropriate handler based on method
        let result;

        if (requestBody.method === 'tools/list') {
          result = await this.handlers.handleListTools();
        } else if (requestBody.method === 'tools/call') {
          result = await this.handlers.handleCallTool(requestBody);
        } else {
          res.status(400).json({ error: `Unknown method: ${requestBody.method}` });
          return;
        }

        res.json(result);
      } catch (error) {
        console.error('MCP HTTP handler error:', error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    };
  }

  /**
   * Get the underlying Server instance
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Close the MCP server
   */
  async close(): Promise<void> {
    await this.server.close();
  }
}

// Singleton instance
let mcpServerInstance: McpServer | null = null;

/**
 * Get or create the MCP server singleton
 */
export function getMcpServer(): McpServer {
  if (!mcpServerInstance) {
    mcpServerInstance = new McpServer();
  }
  return mcpServerInstance;
}
