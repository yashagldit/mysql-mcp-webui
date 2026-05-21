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
import { getSessionManager } from './session-manager.js';
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';

export class McpServer {
  private handlers: McpHandlers;
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();
  private servers: Map<string, Server> = new Map();

  constructor() {
    this.handlers = new McpHandlers();

    // When the SessionManager evicts a stale/expired session, drop the paired
    // HTTP transport and Server too — otherwise the next call from that
    // client would reuse a transport whose session-level state has vanished,
    // which is one of the ways the server appeared to "get stuck after a
    // few queries".
    getSessionManager().onSessionRemoved((sessionId) => {
      this.disposeSession(sessionId);
    });
  }

  /**
   * Create a new MCP Server instance with handlers wired up. SDK 1.29+ rejects
   * reusing one Server across multiple transports, so HTTP mode creates one
   * per session and stdio mode creates one for its single connection.
   */
  private createServer(): Server {
    const server = new Server(
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

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return await this.handlers.handleListTools();
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await this.handlers.handleCallTool(request);
    });

    return server;
  }

  /**
   * Tear down everything associated with a session: transport, Server, and
   * SessionManager entry. Safe to call multiple times.
   */
  private disposeSession(sessionId: string): void {
    const transport = this.transports.get(sessionId);
    if (transport) {
      this.transports.delete(sessionId);
      try { void transport.close(); } catch { /* ignore */ }
    }
    const server = this.servers.get(sessionId);
    if (server) {
      this.servers.delete(sessionId);
      try { void server.close(); } catch { /* ignore */ }
    }
    try { getSessionManager().deleteSession(sessionId); } catch { /* ignore */ }
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

    let authenticationValid = false;
    let authErrorMessage: string | null = null;

    if (!authToken) {
      authErrorMessage = 'Missing AUTH_TOKEN';
      console.error('⚠️  Warning: AUTH_TOKEN not provided. MCP tools will return setup instructions.');
    } else {
      const authResult = this.verifyToken(authToken);
      if (!authResult.valid) {
        authErrorMessage = 'Invalid AUTH_TOKEN';
        console.error('⚠️  Warning: AUTH_TOKEN is invalid. MCP tools will return setup instructions.');
      } else {
        authenticationValid = true;
        // Set API key ID for logging
        if (authResult.apiKeyId) {
          this.handlers.setApiKeyId(authResult.apiKeyId);
        }
        console.error('✓ AUTH_TOKEN validated successfully');
      }
    }

    // Set authentication state and session info for stdio mode
    this.handlers.setAuthenticationState(authenticationValid, authErrorMessage);
    this.handlers.setSession(null, 'stdio');

    const transport = new StdioServerTransport();
    const server = this.createServer();
    await server.connect(transport);

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

        // Check for response format preference header
        const responseFormatHeader = req.headers['x-response-format'] as string | undefined;
        const responseFormat = responseFormatHeader?.toLowerCase() === 'toon' ? 'toon' :
                              responseFormatHeader?.toLowerCase() === 'json' ? 'json' : null;

        // Set session info for dual-mode handling
        this.handlers.setSession(sessionId || null, 'http');

        // Store response format in session (if session exists and format is provided)
        if (sessionId && responseFormat) {
          const sessionManager = getSessionManager();
          sessionManager.setResponseFormat(sessionId, responseFormat);
        }

        let transport: StreamableHTTPServerTransport;
        let isNewTransport = false;

        if (sessionId && this.transports.has(sessionId)) {
          // Reuse existing transport
          transport = this.transports.get(sessionId)!;
        } else if (sessionId && !this.transports.has(sessionId)) {
          // Client is using a session ID we no longer know about (server
          // restart, transport cleanup after a prior error, idle eviction).
          // Tell the client to re-initialize instead of silently hanging.
          res.status(404).json({
            jsonrpc: '2.0',
            error: {
              code: -32001,
              message: 'Session not found. Please re-initialize the MCP session.',
            },
            id: null,
          });
          return;
        } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
          // Create new transport AND a new Server for this session. SDK 1.29+
          // rejects connecting the same Server to multiple transports, so
          // each session gets its own pair.
          isNewTransport = true;
          const sessionServer = this.createServer();
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId: string) => {
              console.error(`MCP session initialized with ID: ${sessionId}`);
              this.transports.set(sessionId, transport);
              this.servers.set(sessionId, sessionServer);
              // Store response format for new session
              if (responseFormat) {
                const sessionManager = getSessionManager();
                sessionManager.setResponseFormat(sessionId, responseFormat);
              }
            },
            onsessionclosed: (sessionId: string) => {
              console.error(`MCP session closed: ${sessionId}`);
              this.disposeSession(sessionId);
            },
          });

          // Set up onclose handler to clean up transport when closed
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && (this.transports.has(sid) || this.servers.has(sid))) {
              console.error(`Transport closed for session ${sid}`);
              this.disposeSession(sid);
            }
          };

          // Connect the per-session server to its transport
          await sessionServer.connect(transport);
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

        // Handle the request with the transport. If it throws, the transport
        // can be left in an indeterminate state — drop it so the next call
        // forces a clean re-init instead of reusing a broken one.
        try {
          await transport.handleRequest(req, res, req.body);
        } catch (handleError) {
          const sid = transport.sessionId;
          if (sid && (this.transports.has(sid) || this.servers.has(sid))) {
            console.error(`Transport handleRequest failed for session ${sid}, evicting:`, handleError);
            this.disposeSession(sid);
          } else if (isNewTransport) {
            try { await transport.close(); } catch { /* ignore */ }
          }
          throw handleError;
        }
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
   * Close every active per-session Server and transport. Called on process
   * shutdown.
   */
  async close(): Promise<void> {
    const sessionIds = Array.from(this.servers.keys());
    for (const sid of sessionIds) {
      this.disposeSession(sid);
    }
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
