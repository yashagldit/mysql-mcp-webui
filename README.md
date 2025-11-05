# MySQL MCP WebUI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

A MySQL MCP (Model Context Protocol) server with a React-based web UI for live configuration management. Enable Claude AI to interact with your MySQL databases through a secure, intuitive interface.

## Features

- **Dual Authentication System**: Username/password login for WebUI or API token authentication for programmatic access
- **User Management**: Create and manage multiple users with secure password hashing (bcrypt)
- **Web UI for Configuration**: Manage MySQL connections, databases, and permissions through an intuitive web interface
- **Multi-Instance Support**: Run multiple Claude Desktop instances or HTTP sessions simultaneously with isolated state
- **Auto-Discovery**: Automatically discovers databases from MySQL server connections
- **Per-Database Permissions**: Fine-grained control over 8 different operation types (SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE)
- **Live Database Switching**: Switch between databases without restarting the server
- **Dual Transport Support**: Works with both stdio and HTTP transports
- **MCP Tools**: Three powerful tools for Claude to interact with your MySQL databases
- **Production Ready**: HTTPS/TLS support, rate limiting, Docker deployment
- **Secure**: AES-256-GCM password encryption, JWT authentication, API token support
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
# Login with default credentials: admin / admin
# You'll be prompted to change the password on first login
```

**First Login:**
- Username: `admin`
- Password: `admin`
- You will be forced to change the password immediately for security

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

### Authentication

- `POST /api/auth/login` - Login with username/password or API token
- `POST /api/auth/logout` - Logout (clears JWT cookie)
- `GET /api/auth/me` - Get current user info (requires auth)
- `POST /api/auth/change-password` - Change user password
- `POST /api/auth/check-token` - Validate API token

### User Management

- `GET /api/users` - List all users (requires auth)
- `POST /api/users` - Create new user (requires auth)
- `PUT /api/users/:id` - Update user details (requires auth)
- `PUT /api/users/:id/password` - Admin password reset (requires auth)
- `DELETE /api/users/:id` - Delete user (requires auth)

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

### API Keys

- `GET /api/keys` - List all API keys
- `POST /api/keys` - Create new API key
- `PUT /api/keys/:id` - Update API key
- `DELETE /api/keys/:id` - Revoke API key
- `GET /api/keys/:id/logs` - Get API key usage logs

### Request Logs

- `GET /api/logs` - List request logs with pagination
- `GET /api/logs/:id` - Get specific log entry
- `GET /api/logs/stats` - Get logging statistics
- `DELETE /api/logs?days=30` - Clear old logs

### Settings

- `GET /api/settings` - Get server settings
- `GET /api/active` - Get current active state
- `GET /api/health` - Health check (no auth required)

### MCP

- `POST /mcp` - MCP protocol endpoint (requires API key)

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

- **Users**: User accounts for WebUI authentication with hashed passwords
- **API Keys**: Multiple authentication keys for programmatic access and MCP
- **Connections**: MySQL server connection details (encrypted passwords)
- **Databases**: Per-database permissions and metadata
- **Request Logs**: API and MCP request/response history
- **Settings**: Server configuration (transport mode, port, etc.)

### Environment Variables

#### Required Variables
- `TRANSPORT` - Transport mode: `stdio` or `http` (default: http)
- `HTTP_PORT` - HTTP server port (default: 3000)
- `NODE_ENV` - Environment: `development` or `production`

#### Authentication Variables
- `JWT_SECRET` - Secret for JWT token signing (32+ characters, optional in HTTP development mode, not used in stdio mode)
- `JWT_EXPIRES_IN` - JWT token expiration time (default: 7d)
- `AUTH_TOKEN` - API key for authentication (required for stdio mode only)

#### Optional Variables
- `ENABLE_HTTPS` - Enable HTTPS (default: false)
- `SSL_CERT_PATH` - Path to SSL certificate file
- `SSL_KEY_PATH` - Path to SSL private key file
- `RATE_LIMIT_ENABLED` - Enable rate limiting (default: true)
- `RATE_LIMIT_WINDOW_MS` - Rate limit window in milliseconds (default: 900000 / 15 minutes)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

**Note**: In development HTTP mode, a default JWT secret is used if not provided. For production HTTP mode, `JWT_SECRET` must be explicitly set. Stdio mode (MCP via Claude Desktop) doesn't require JWT_SECRET as it uses API key authentication.

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed configuration examples and production setup.

## Security Features

- **Dual Authentication**: JWT-based authentication for WebUI users + API key authentication for MCP/programmatic access
- **Password Security**: bcrypt hashing (10 salt rounds) for user passwords with forced password change on first login
- **AES-256-GCM Encryption**: All MySQL database passwords are encrypted at rest
- **JWT Tokens**: httpOnly cookies with configurable expiration for secure session management
- **Rate Limiting**: Configurable per-endpoint rate limiting to prevent abuse
- **HTTPS/TLS Support**: Production-ready SSL/TLS encryption for all connections
- **Permission Validation**: Query permissions are checked before execution
- **Transaction Support**: All queries run in transactions with automatic rollback on error
- **SQL Injection Prevention**: Uses parameterized queries via mysql2
- **Constant-Time Comparison**: Prevents timing attacks on token verification
- **User Management**: Multi-user support with secure CRUD operations

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
│  │  - Users (hashed passwords)       │        │
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
- jsonwebtoken (JWT authentication)
- bcrypt (password hashing)
- cookie-parser (session management)

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
- **Dual authentication system (JWT for WebUI + API keys for MCP)**
- **Multi-user support with secure password management**
- Request/response logging with user tracking
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
- Role-based access control (RBAC)
- Query history and favorites
- Advanced permissions (table/column level)
- Query result export (CSV, JSON, etc.)
- Database schema explorer
- Monitoring and metrics dashboard
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
