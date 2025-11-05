# MySQL MCP WebUI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

A MySQL MCP (Model Context Protocol) server with a React-based web UI for live configuration management. Enable Claude AI to interact with your MySQL databases through a secure, intuitive interface.

## Features

- **Web UI for Configuration**: Manage MySQL connections, databases, and permissions through an intuitive web interface
- **Multi-Instance Support**: Run multiple Claude Desktop instances or HTTP sessions simultaneously with isolated state
- **Auto-Discovery**: Automatically discovers databases from MySQL server connections
- **Per-Database Permissions**: Fine-grained control over 8 different operation types (SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE)
- **Live Database Switching**: Switch between databases without restarting the server
- **Dual Transport Support**: Works with both stdio and HTTP transports
- **MCP Tools**: Three powerful tools for Claude to interact with your MySQL databases
- **Production Ready**: HTTPS/TLS support, rate limiting, Docker deployment
- **Secure**: AES-256-GCM password encryption, token-based authentication
- **Multiple Connections**: Manage multiple MySQL server connections from a single interface

## Quick Start

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

### Development Mode

```bash
# Run server in development mode
npm run dev:server

# In another terminal, run client dev server (when ready)
npm run dev:client

# Or run both together
npm run dev
```

### Production Mode

```bash
# Build both server and client
npm run build

# Start server in HTTP mode
npm run start:http

# Or start in stdio mode
npm run start:stdio
```

### Docker Deployment (Recommended for Production)

For production deployments with HTTPS, rate limiting, and multi-instance support:

```bash
# Clone and configure
git clone <repository-url>
cd MySQLMCP
cp .env.example .env
# Edit .env with your configuration

# Start with Docker Compose
docker-compose up -d

# Access Web UI at http://localhost:3000
# Get your API key from logs
docker-compose logs mysql-mcp | grep "API key"
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for comprehensive deployment guide including HTTPS setup, multi-instance configuration, and security best practices.

## Multi-Instance Support

MySQL MCP WebUI supports running multiple instances simultaneously with proper isolation:

### stdio Mode (Multiple Processes)
- Each Claude Desktop instance spawns a separate MCP server process
- Each process maintains independent active connection/database state
- Shared SQLite database with safe concurrent writes (WAL mode + retry logic)
- **Use case**: Multiple Claude Desktop users on the same machine

### HTTP Mode (Multiple Sessions)
- Single Docker container serves multiple Claude Code sessions
- Each HTTP session maintains isolated connection/database state
- Session-based tracking with automatic cleanup (30 minutes)
- **Use case**: Remote access from multiple developers or Claude Code instances

### Default Connection Management

The Web UI can set a "default connection" that new instances will use:

1. Navigate to Connections in Web UI
2. Click "Set as Default" on desired connection
3. New MCP instances will start with this connection
4. **Important**: Running instances are NOT affected

This allows coordination across instances without disrupting active sessions.

## MCP Tools

### 1. `mysql_query`

Execute SQL queries against the active database with permission validation.

```json
{
  "name": "mysql_query",
  "arguments": {
    "sql": "SELECT * FROM users LIMIT 10"
  }
}
```

### 2. `list_databases`

List all available databases with their permissions and metadata.

```json
{
  "name": "list_databases",
  "arguments": {
    "include_metadata": true
  }
}
```

### 3. `switch_database`

Switch to a different database in the active connection.

```json
{
  "name": "switch_database",
  "arguments": {
    "database": "my_database"
  }
}
```

## REST API Endpoints

### Connections

- `GET /api/connections` - List all connections
- `POST /api/connections` - Add new connection
- `GET /api/connections/:id` - Get specific connection
- `PUT /api/connections/:id` - Update connection
- `DELETE /api/connections/:id` - Delete connection
- `POST /api/connections/:id/test` - Test connection
- `POST /api/connections/:id/set-default` - Set as default for new instances
- `GET /api/connections/default` - Get current default connection
- `POST /api/connections/:id/activate` - Switch to connection (deprecated, use set-default)
- `POST /api/connections/:id/discover` - Discover databases

### Databases

- `GET /api/connections/:id/databases` - List databases
- `POST /api/connections/:connId/databases/:dbName/activate` - Switch database
- `PUT /api/connections/:connId/databases/:dbName/permissions` - Update permissions

### Queries

- `POST /api/query` - Execute SQL query

### Settings

- `GET /api/settings` - Get server settings
- `POST /api/settings/token/rotate` - Rotate authentication token
- `GET /api/active` - Get current active state
- `GET /api/health` - Health check (no auth required)

### MCP

- `POST /mcp` - MCP protocol endpoint

## MCP Client Configuration

### For Claude Desktop

Add one of these configurations to your Claude Desktop config file (`~/.claude.json` or `~/Library/Application Support/Claude/claude_desktop_config.json`):

#### Option 1: HTTP Mode (For Already-Running Server)

Use this when the server is already running (via `npm start` or docker):

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY_HERE"
      }
    }
  }
}
```

**When to use:**
- Server is already running independently
- Remote server access
- Production deployments
- Docker containers

#### Option 2: Stdio Mode (Let Claude Desktop Manage Server)

Use this to let Claude Desktop start and stop the server automatically:

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "node",
      "args": [
        "/path/to/mysql-mcp-webui/server/dist/index.js"
      ],
      "env": {
        "TRANSPORT": "stdio",
        "AUTH_TOKEN": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

**When to use:**
- Local development
- Want automatic server lifecycle management
- Simpler setup (no need to manually start server)

Replace `YOUR_API_KEY_HERE` with an API key from the Settings page.

## Configuration

Configuration is stored in SQLite database at `data/mysql-mcp.db`:

- **API Keys**: Multiple authentication keys with individual activation
- **Connections**: MySQL server connection details (encrypted passwords)
- **Databases**: Per-database permissions and metadata
- **Settings**: Server configuration (transport mode, port, etc.)

### Environment Variables

#### Required Variables
- `TRANSPORT` - Transport mode: `stdio` or `http` (default: http)
- `HTTP_PORT` - HTTP server port (default: 3000)
- `NODE_ENV` - Environment: `development` or `production`

#### Optional Variables
- `ENABLE_HTTPS` - Enable HTTPS (default: false)
- `SSL_CERT_PATH` - Path to SSL certificate file
- `SSL_KEY_PATH` - Path to SSL private key file
- `RATE_LIMIT_ENABLED` - Enable rate limiting (default: true)
- `RATE_LIMIT_WINDOW_MS` - Rate limit window in milliseconds (default: 900000 / 15 minutes)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)
- `AUTH_TOKEN` - Authentication token (required for stdio mode only)

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed configuration examples and production setup.

## Security Features

- **AES-256-GCM Encryption**: All database passwords are encrypted at rest
- **Token Authentication**: Secure token-based authentication for all API and MCP requests
- **Rate Limiting**: Configurable per-endpoint rate limiting to prevent abuse
- **HTTPS/TLS Support**: Production-ready SSL/TLS encryption for all connections
- **Permission Validation**: Query permissions are checked before execution
- **Transaction Support**: All queries run in transactions with automatic rollback on error
- **SQL Injection Prevention**: Uses parameterized queries via mysql2
- **Constant-Time Comparison**: Prevents timing attacks on token verification

## Architecture

```
┌─────────────────────────────────────────────┐
│    MCP Clients (Claude Desktop/Code)        │
│    Multiple instances with isolated state    │
└────────────────┬────────────────────────────┘
                 │ MCP Protocol (stdio/HTTP)
┌────────────────▼────────────────────────────┐
│         MySQL MCP WebUI Server               │
│                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   MCP    │  │ REST API │  │ Web UI   │  │
│  │  Tools   │  │          │  │ (React)  │  │
│  └────┬─────┘  └────┬─────┘  └──────────┘  │
│       │             │                        │
│  ┌────▼─────────────▼──────────────┐        │
│  │    Session Manager (HTTP mode)  │        │
│  │    Connection Manager            │        │
│  │    Query Executor                │        │
│  │    Permission Validator          │        │
│  │    Database Manager (SQLite)     │        │
│  └────────────────┬─────────────────┘        │
│                   │                           │
│  ┌────────────────▼─────────────────┐        │
│  │  SQLite DB (WAL mode + retries)  │        │
│  │  - API Keys                       │        │
│  │  - Connections (encrypted)        │        │
│  │  - Databases & Permissions        │        │
│  │  - Request Logs                   │        │
│  └───────────────────────────────────┘        │
└───────────────────┼──────────────────────────┘
                    │ MySQL Protocol
          ┌─────────▼─────────┐
          │  MySQL Server(s)  │
          └───────────────────┘
```

## Technology Stack

### Backend
- Node.js 20+
- TypeScript 5.x
- @modelcontextprotocol/sdk
- Express 5.x
- mysql2 with Promise support
- node-sql-parser
- Zod for validation

### Frontend
- React 18
- TypeScript 5.x
- Vite 6.x
- TailwindCSS
- @tanstack/react-query
- Monaco Editor

## Development

### Project Structure

```
mysql-mcp-webui/
├── server/           # Backend server
│   ├── src/
│   │   ├── api/      # REST API routes
│   │   ├── config/   # Config management
│   │   ├── db/       # Database layer
│   │   ├── mcp/      # MCP server
│   │   └── types/    # TypeScript types
│   └── dist/         # Compiled output
├── client/           # React frontend
│   └── src/
└── data/             # Runtime data
    └── mysql-mcp.db  # SQLite configuration database
```

### Building

```bash
# Build server
npm run build:server

# Build client (when ready)
npm run build:client

# Build both
npm run build
```

## Roadmap

### Current Features ✅
- Full MCP server implementation with three powerful tools
- Complete REST API for connection and database management
- React-based web UI for configuration management
- Multi-API key authentication system
- Request/response logging
- Dual transport support (stdio/http)
- **Multi-instance support with isolated state (stdio and HTTP modes)**
- **Production-ready Docker deployment**
- **HTTPS/TLS support with Let's Encrypt integration**
- **Configurable rate limiting**
- Encrypted password storage
- Per-database permission management
- **Safe concurrent SQLite writes with retry logic**
- **Session-based isolation for HTTP mode**

### Planned Features
- Query history and favorites
- Advanced permissions (table/column level)
- Query result export (CSV, JSON, etc.)
- Database schema explorer
- Monitoring and metrics dashboard
- Multi-user support with role-based access
- Query performance analysis
- Backup and restore management

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting pull requests.

For detailed architecture information, see [CLAUDE.md](CLAUDE.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Report bugs and request features via [GitHub Issues](https://github.com/yashagldit/mysql-mcp-webui/issues)
- For questions and discussions, use [GitHub Discussions](https://github.com/yashagldit/mysql-mcp-webui/discussions)

## Acknowledgments

- Created and maintained by [Yash Agarwal](https://github.com/yashagldit)
- Built with [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- Powered by [Claude AI](https://claude.ai/)
