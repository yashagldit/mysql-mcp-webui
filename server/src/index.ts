#!/usr/bin/env node

import { getDatabaseManager } from './db/database-manager.js';
import { getMcpServer } from './mcp/server.js';
import { createHttpServer } from './http-server.js';
import { getConnectionManager } from './db/connection-manager.js';

async function main() {
  try {
    console.error('Starting MySQL MCP WebUI Server...');

    // Initialize database
    const dbManager = getDatabaseManager();

    // Ensure at least one API key exists
    const apiKeys = dbManager.getAllApiKeys();
    if (apiKeys.length === 0) {
      const firstKey = dbManager.createApiKey('Default API Key');
      console.error(`Created initial API key: ${firstKey.key}`);
      console.error('Please save this key - it will not be shown again!');
    } else {
      console.error(`Found ${apiKeys.length} API key(s) in database`);
    }

    // Get transport setting
    const transport = process.env.TRANSPORT || dbManager.getSetting('transport') || 'http';
    console.error(`Transport mode: ${transport}`);

    if (transport === 'stdio') {
      // Stdio mode - MCP + Web UI
      console.error('Running in stdio mode (MCP + Web UI)');

      // Start MCP server in stdio mode
      const mcpServer = getMcpServer();
      await mcpServer.startStdio();
      console.error('MCP server started successfully');

      // Also start HTTP server for Web UI
      const port = parseInt(process.env.HTTP_PORT || dbManager.getSetting('httpPort') || '3000');
      const app = createHttpServer();

      try {
        const server = app.listen(port, () => {
          console.error(`Web UI available at: http://localhost:${port}`);
          console.error(`API available at: http://localhost:${port}/api`);
        });

        // Graceful shutdown
        const shutdown = async (signal: string) => {
          console.error(`\nReceived ${signal}, shutting down gracefully...`);

          server.close(async () => {
            console.error('HTTP server closed');

            // Close MCP server
            await mcpServer.close();
            console.error('MCP server closed');

            // Close all database connections
            const connectionManager = getConnectionManager();
            await connectionManager.closeAll();
            console.error('Database connections closed');

            process.exit(0);
          });

          // Force shutdown after 10 seconds
          setTimeout(() => {
            console.error('Forcing shutdown after timeout');
            process.exit(1);
          }, 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
      } catch (error) {
        console.error(`Warning: Failed to start HTTP server on port ${port}:`, error);
        console.error('MCP server will continue running without Web UI');
      }
    } else {
      // HTTP mode - Both MCP and REST API
      console.error('Running in HTTP mode (MCP + REST API + Web UI)');

      const port = parseInt(process.env.HTTP_PORT || dbManager.getSetting('httpPort') || '3000');
      const app = createHttpServer();

      const server = app.listen(port, () => {
        console.error(`HTTP server listening on port ${port}`);
        console.error(`Web UI: http://localhost:${port}`);
        console.error(`API: http://localhost:${port}/api`);
        console.error(`MCP endpoint: http://localhost:${port}/mcp`);
        console.error(`Health check: http://localhost:${port}/api/health`);
      });

      // Graceful shutdown
      const shutdown = async (signal: string) => {
        console.error(`\nReceived ${signal}, shutting down gracefully...`);

        server.close(async () => {
          console.error('HTTP server closed');

          // Close MCP server
          const mcpServer = getMcpServer();
          await mcpServer.close();
          console.error('MCP server closed');

          // Close all database connections
          const connectionManager = getConnectionManager();
          await connectionManager.closeAll();
          console.error('Database connections closed');

          process.exit(0);
        });

        // Force shutdown after 10 seconds
        setTimeout(() => {
          console.error('Forcing shutdown after timeout');
          process.exit(1);
        }, 10000);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

main();
