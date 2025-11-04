#!/usr/bin/env node

import { getConfigManager } from './config/manager.js';
import { getMcpServer } from './mcp/server.js';
import { createHttpServer } from './http-server.js';
import { getConnectionManager } from './db/connection-manager.js';

async function main() {
  try {
    console.error('Starting MySQL MCP WebUI Server...');

    // Load configuration
    const configManager = getConfigManager();
    await configManager.loadConfig();
    const config = configManager.getConfig();

    console.error(`Server token: ${config.serverToken}`);
    console.error(`Transport mode: ${config.transport}`);

    // Determine transport mode
    const transport = process.env.TRANSPORT || config.transport;

    if (transport === 'stdio') {
      // Stdio mode - MCP only
      console.error('Running in stdio mode (MCP only)');

      const mcpServer = getMcpServer();
      await mcpServer.startStdio();

      console.error('MCP server started successfully');
    } else {
      // HTTP mode - Both MCP and REST API
      console.error('Running in HTTP mode (MCP + REST API + Web UI)');

      const port = parseInt(process.env.HTTP_PORT || String(config.httpPort)) || 3000;
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
