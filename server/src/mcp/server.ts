import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { McpHandlers } from './handlers.js';
import { getDatabaseManager } from '../db/database-manager.js';
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';

export class McpServer {
  private server: Server;
  private handlers: McpHandlers;
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();

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
   * Verify authentication token and return API key info
   */
  private verifyToken(token?: string): { valid: boolean; apiKeyId?: string } {
    if (!token) {
      return { valid: false };
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;

    // Verify API key using DatabaseManager
    const dbManager = getDatabaseManager();
    const apiKey = dbManager.verifyApiKey(cleanToken);

    if (apiKey === null) {
      return { valid: false };
    }

    return { valid: true, apiKeyId: apiKey.id };
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

    const authResult = this.verifyToken(authToken);
    if (!authResult.valid) {
      throw new Error('Invalid AUTH_TOKEN provided');
    }

    // Set API key ID for logging
    if (authResult.apiKeyId) {
      this.handlers.setApiKeyId(authResult.apiKeyId);
    }

    // Set session info for stdio mode (no session ID, uses process-level state)
    this.handlers.setSession(null, 'stdio');

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('MCP Server running on stdio transport');
  }

  /**
   * Setup HTTP transport using StreamableHTTPServerTransport (2025-03-26 spec)
   * This configures the Express app with the MCP endpoint
   */
  setupHttpTransport(app: Express): void {
    // Handle all MCP Streamable HTTP requests (GET, POST, DELETE) on a single endpoint
    app.all('/mcp', async (req, res) => {
      try {
        // Verify authentication first
        const authHeader = req.headers.authorization;
        const authResult = this.verifyToken(authHeader);

        if (!authResult.valid) {
          res.status(401).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Unauthorized: Invalid or missing API key',
            },
            id: null,
          });
          return;
        }

        // Check if MCP is enabled
        const dbManager = getDatabaseManager();
        if (!dbManager.getMcpEnabled()) {
          res.status(503).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'MCP service is currently disabled',
            },
            id: null,
          });
          return;
        }

        // Set API key ID for logging
        if (authResult.apiKeyId) {
          this.handlers.setApiKeyId(authResult.apiKeyId);
        }

        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        // Set session info for dual-mode handling
        this.handlers.setSession(sessionId || null, 'http');
        let transport: StreamableHTTPServerTransport;

        if (sessionId && this.transports.has(sessionId)) {
          // Reuse existing transport
          transport = this.transports.get(sessionId)!;
        } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
          // Create new transport for initialization request
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId: string) => {
              console.error(`MCP session initialized with ID: ${sessionId}`);
              this.transports.set(sessionId, transport);
            },
            onsessionclosed: (sessionId: string) => {
              console.error(`MCP session closed: ${sessionId}`);
              this.transports.delete(sessionId);
            },
          });

          // Set up onclose handler to clean up transport when closed
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && this.transports.has(sid)) {
              console.error(`Transport closed for session ${sid}`);
              this.transports.delete(sid);
            }
          };

          // Connect the transport to the MCP server
          await this.server.connect(transport);
        } else {
          // Invalid request - no session ID or not initialization request
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided or not an initialization request',
            },
            id: null,
          });
          return;
        }

        // Handle the request with the transport
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('MCP HTTP handler error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });

    console.error('MCP HTTP transport configured at /mcp endpoint');
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
