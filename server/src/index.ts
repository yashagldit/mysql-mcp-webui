#!/usr/bin/env node

import https from 'https';
import { getDatabaseManager } from './db/database-manager.js';
import { getMcpServer } from './mcp/server.js';
import { createHttpServer } from './http-server.js';
import { getConnectionManager } from './db/connection-manager.js';
import { loadEnvironment, getConfigSummary } from './config/environment.js';
import { loadTlsConfig, createHttpsOptions } from './config/tls.js';

function showHelp() {
  try {
    // Get the actual installation path
    const scriptPath = new URL(import.meta.url).pathname;

    // Get or create default API key
    const dbManager = getDatabaseManager();
    let apiKeys = dbManager.getAllApiKeys();
    let apiKey: string;

    if (apiKeys.length === 0) {
      const newKey = dbManager.createApiKey('Default API Key');
      apiKey = newKey.key;
    } else {
      apiKey = apiKeys[0].key;
    }

    console.log(`
MySQL MCP WebUI - MySQL Database MCP Server with Web UI
Version: 0.1.2

USAGE:
  mysql-mcp-webui [OPTIONS]

OPTIONS:
  --help, -h            Show this help message
  --generate-token      Generate a new API token for MCP authentication
  --version, -v         Show version information

CLAUDE DESKTOP CONFIGURATION:
  Add to ~/.config/Claude/claude_desktop_config.json or
  ~/Library/Application Support/Claude/claude_desktop_config.json:

  {
    "mcpServers": {
      "mysql-mcp": {
        "command": "node",
        "args": [
          "${scriptPath}"
        ],
        "env": {
          "TRANSPORT": "stdio",
          "AUTH_TOKEN": "${apiKey}",
          "HTTP_PORT": "9274"
        }
      }
    }
  }

  Note: HTTP_PORT is for the Web UI (separate from MCP stdio communication)
        Generate a new token with: mysql-mcp-webui --generate-token

WEB UI:
  Access the configuration interface at http://localhost:9274
  Default credentials: admin / admin (change on first login)

DOCUMENTATION:
  https://github.com/yashagldit/mysql-mcp-webui
`);
  } catch (error) {
    console.error('Error displaying help:', error);
  }
}

function generateToken() {
  try {
    console.log('Generating new API token...\n');
    const dbManager = getDatabaseManager();
    const apiKey = dbManager.createApiKey('CLI Generated Token');

    console.log('✓ API Token generated successfully!\n');
    console.log('━'.repeat(60));
    console.log(`  ${apiKey.key}`);
    console.log('━'.repeat(60));
    console.log('\n⚠️  IMPORTANT: Save this token securely!');
    console.log('   This token will NOT be shown again.\n');
    console.log('Use this token in your Claude Desktop config:\n');
    console.log('  "env": {');
    console.log('    "TRANSPORT": "stdio",');
    console.log(`    "AUTH_TOKEN": "${apiKey.key}"`);
    console.log('  }\n');
    process.exit(0);
  } catch (error) {
    console.error('Error generating token:', error);
    process.exit(1);
  }
}

async function main() {
  try {
    // Handle CLI arguments
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      process.exit(0);
    }

    if (args.includes('--version') || args.includes('-v')) {
      console.log('mysql-mcp-webui version 0.1.2');
      process.exit(0);
    }

    if (args.includes('--generate-token')) {
      generateToken();
      return;
    }

    console.error('Starting MySQL MCP WebUI Server...');

    // Default to production if NODE_ENV not set (for npm global installs)
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = 'production';
    }

    // Load environment configuration
    const config = loadEnvironment();
    console.error(getConfigSummary(config));

    // Initialize database
    const dbManager = getDatabaseManager();

    // Ensure default admin user exists (async operation)
    await dbManager.ensureDefaultAdminUser();

    // Ensure at least one API key exists
    const apiKeys = dbManager.getAllApiKeys();
    if (apiKeys.length === 0) {
      const firstKey = dbManager.createApiKey('Default API Key');
      console.error(`Created initial API key: ${firstKey.key}`);
      console.error('Please save this key - it will not be shown again!');
    } else {
      console.error(`Found ${apiKeys.length} API key(s) in database`);
    }

    if (config.transport === 'stdio') {
      // Stdio mode - MCP + Web UI
      console.error('Running in stdio mode (MCP + Web UI)');

      // Start MCP server in stdio mode (validates AUTH_TOKEN but starts anyway)
      const mcpServer = getMcpServer();
      await mcpServer.startStdio();

      // Also start HTTP server for Web UI (no HTTPS in stdio mode for Web UI)
      const app = createHttpServer(config);

      try {
        const server = app.listen(config.httpPort, () => {
          console.error(`Web UI available at: http://localhost:${config.httpPort}`);
          console.error(`API available at: http://localhost:${config.httpPort}/api`);
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
        console.error(`Warning: Failed to start HTTP server on port ${config.httpPort}:`, error);
        console.error('MCP server will continue running without Web UI');
      }
    } else {
      // HTTP mode - Both MCP and REST API
      console.error('Running in HTTP mode (MCP + REST API + Web UI)');

      const app = createHttpServer(config);

      // Load TLS config if HTTPS is enabled
      let server;
      let protocol = 'http';

      if (config.enableHttps && config.sslCertPath && config.sslKeyPath) {
        try {
          const tlsConfig = loadTlsConfig(config.sslCertPath, config.sslKeyPath);
          if (tlsConfig) {
            const httpsOptions = createHttpsOptions(tlsConfig);
            server = https.createServer(httpsOptions, app);
            protocol = 'https';
            console.error('HTTPS enabled');
          }
        } catch (error) {
          console.error('Failed to load TLS configuration:', error);
          console.error('Falling back to HTTP');
        }
      }

      // Fall back to HTTP if HTTPS failed or not configured
      if (!server) {
        server = app.listen(config.httpPort);
      } else {
        server.listen(config.httpPort);
      }

      console.error(`${protocol.toUpperCase()} server listening on port ${config.httpPort}`);
      console.error(`Web UI: ${protocol}://localhost:${config.httpPort}`);
      console.error(`API: ${protocol}://localhost:${config.httpPort}/api`);
      console.error(`MCP endpoint: ${protocol}://localhost:${config.httpPort}/mcp`);
      console.error(`Health check: ${protocol}://localhost:${config.httpPort}/api/health`);

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
