# MySQL MCP WebUI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![npm version](https://img.shields.io/badge/npm-v0.1.2-blue)](https://www.npmjs.com/package/mysql-mcp-webui)

A MySQL MCP (Model Context Protocol) server with a React-based web UI for live configuration management. Enable Claude AI to interact with your MySQL databases through a secure, intuitive interface.

---

**📖 Looking for user documentation?** See [README.md](README.md) for:
- Quick start guide and installation
- MCP tools explanation with example conversations
- Configuration and setup instructions
- Use cases and troubleshooting

**This document (README_DEVELOPMENT.md) contains:**
- Technical architecture and design patterns
- Development setup and guidelines
- REST API documentation
- Contributing guidelines

## Features

### Core Features
- **Dual Authentication System**: Username/password login for WebUI or API token authentication for programmatic access
- **User Management**: Create and manage multiple users with secure password hashing (bcrypt)
- **Multi-Instance Support**: Run multiple Claude Desktop instances or HTTP sessions simultaneously with isolated state
- **MCP Tools**: Four powerful tools for Claude to interact with your MySQL databases (query, list_databases, switch_database, add_connection)
- **Dual Transport Support**: Works with both stdio (Claude Desktop) and HTTP (Claude Code) transports
- **TOON Format Support**: Optional token-optimized response format for ~40% token reduction (v0.1.2)
- **Database Aliasing**: Create custom, user-friendly aliases for databases (v0.1.0)
- **Connection Management**: Enable/disable connections to control which are active (v0.1.0)

### Web UI Capabilities
- **Database Browser**: Browse tables, view structure, explore data with pagination, and view indexes - all through an intuitive web interface
- **Query Editor**: Execute SQL queries with syntax highlighting via Monaco Editor
- **Connection Management**: Add, test, and manage multiple MySQL server connections with enable/disable controls
- **Database Management**: Enable/disable databases, configure permissions, manage custom aliases, and switch active databases
- **Alias Management**: Edit database aliases with validation and uniqueness checks (v0.1.0)
- **Dark Mode**: Comprehensive dark mode support with device preference detection
- **Request Logging**: View detailed logs of API requests, MCP tool calls, and query history
- **API Key Management**: Create and manage multiple API keys with usage tracking

### Security & Production
- **Production Ready**: HTTPS/TLS support with Let's Encrypt integration, rate limiting, Docker deployment
- **Secure Authentication**: AES-256-GCM password encryption, JWT tokens (httpOnly cookies), API key authentication
- **Hardened Security**: Recently audited and patched for all CRITICAL and HIGH severity vulnerabilities
- **Permission Control**: Fine-grained control over 8 operation types (SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE)
- **Transaction Support**: All queries execute in transactions with automatic rollback on error

### Advanced Features
- **Auto-Discovery**: Automatically discovers databases from MySQL server connections
- **Live Database Switching**: Switch between databases and connections without restarting
- **Session Isolation**: HTTP mode supports multiple isolated sessions with automatic cleanup
- **Concurrent SQLite Access**: Safe multi-instance SQLite writes with WAL mode and retry logic
- **Responsive Design**: Mobile-friendly UI that works on all device sizes

## Quick Start

### Installation

#### Option 1: From Source (Development)

```bash
# Clone the repository
git clone https://github.com/yashagldit/mysql-mcp-webui.git
cd mysql-mcp-webui

# Install dependencies
npm install

# Build the project
npm run build
```

#### Option 2: Global Installation (Production)

```bash
# Install globally from npm
npm install -g mysql-mcp-webui

# Run the server
mysql-mcp-webui
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

# Access Web UI at http://localhost:9274
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

## Web Interface

The Web UI provides a comprehensive interface for managing your MySQL connections and exploring databases:

### Available Pages

1. **Dashboard** - Overview of connections, databases, and recent activity
2. **Connections** - Manage MySQL server connections, test connectivity, discover databases
3. **Databases** - View and configure database permissions, enable/disable databases
4. **Browser** - Browse tables, view structure, explore data with pagination, and examine indexes
5. **Query Editor** - Execute SQL queries with Monaco Editor (VS Code editor) and syntax highlighting
6. **API Keys** - Create and manage authentication keys for MCP access
7. **Users** - Manage user accounts and permissions (admin only)
8. **Request Logs** - View detailed logs of all API calls and MCP tool invocations
9. **Settings** - Configure server settings and view active connection state

### Features

- **Dark Mode**: Toggle between light and dark themes, or use system preference
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Real-time Updates**: Live feedback on connection status and query results
- **Keyboard Shortcuts**: Monaco Editor provides VS Code-like shortcuts in query editor
- **Pagination**: Browse large datasets efficiently with configurable page sizes
- **Error Handling**: Clear error messages with helpful debugging information

## MCP Tools

### 1. `mysql_query`

Execute SQL queries against the active database with permission validation. Supports TOON format for token-optimized responses.

```json
{
  "name": "mysql_query",
  "arguments": {
    "database": "my_db_alias",
    "sql": "SELECT * FROM users LIMIT 10"
  }
}
```

**Response Format Options:**
- JSON (default): Standard JSON array with objects
- TOON (optional): Token-Oriented Object Notation for ~40% fewer tokens
  - Configure via `MCP_RESPONSE_FORMAT` environment variable (server-wide)
  - Or via `X-Response-Format` header (per-client in HTTP mode)

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

Switch to a different database in the active connection (supports database aliases).

```json
{
  "name": "switch_database",
  "arguments": {
    "database": "my_database"
  }
}
```

### 4. `add_connection` (v0.1.0)

Create a new MySQL connection programmatically with validation and auto-discovery.

```json
{
  "name": "add_connection",
  "arguments": {
    "name": "Local MySQL",
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "mypassword"
  }
}
```

**Features:**
- Validates connection by testing credentials before saving
- Encrypts password with AES-256-GCM
- Auto-discovers all available databases
- Adds discovered databases with default SELECT permission
- Returns connection details and discovery results

## TOON Format (Token Optimization)

MySQL MCP Server supports **TOON (Token-Oriented Object Notation)** v2.0, an optimized format for returning query results with approximately 40% fewer tokens compared to JSON.

### Configuration

**Priority order (HTTP mode):**
1. `X-Response-Format` header (per-client) - **Recommended**
2. `MCP_RESPONSE_FORMAT` environment variable (server-wide)
3. Default: `json`

**Priority order (stdio mode):**
1. `MCP_RESPONSE_FORMAT` environment variable
2. Default: `json`

### Example Comparison

**Query:** `SELECT id, name, email FROM users LIMIT 3`

**JSON format (125 characters):**
```json
[
  { "id": 1, "name": "Alice", "email": "alice@example.com" },
  { "id": 2, "name": "Bob", "email": "bob@example.com" },
  { "id": 3, "name": "Charlie", "email": "charlie@example.com" }
]
```

**TOON format (85 characters):**
```
[3]{id,name,email}:
 1,Alice,alice@example.com
 2,Bob,bob@example.com
 3,Charlie,charlie@example.com
```

**Token savings: 32% fewer characters**

### When to Use TOON

✅ **Use TOON when:**
- Large query results (100+ rows)
- Cost-sensitive applications where token usage matters
- Maximizing context window efficiency
- Running analytics or reporting queries

✅ **Use JSON when:**
- Small query results (<50 rows)
- Debugging and development
- Traditional API-like responses
- When human readability is prioritized

### Implementation Details

- **Official library**: Uses `@toon-format/toon` for spec-compliant implementation (v0.1.4+)
- **Proper nested handling**: Indentation-based encoding, dotted-key folding, smart format detection
- **TOON v2.0 spec-compliant**: Proper escaping, quoting, number normalization, recursive structures
- **Backward compatible**: Defaults to JSON, opt-in feature
- **Per-client HTTP support**: Different clients can use different formats on the same server

See [HEADER_CONFIG_EXAMPLES.md](HEADER_CONFIG_EXAMPLES.md) for comprehensive configuration examples.

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
- `POST /api/connections/:id/enable` - Enable connection (v0.1.0)
- `POST /api/connections/:id/disable` - Disable connection (v0.1.0)

### Databases

- `GET /api/connections/:id/databases` - List databases
- `POST /api/connections/:connId/databases/:dbName/activate` - Switch database
- `PUT /api/connections/:connId/databases/:dbName/permissions` - Update permissions
- `PUT /api/connections/:connId/databases/:dbName/enable` - Enable database
- `PUT /api/connections/:connId/databases/:dbName/disable` - Disable database
- `POST /api/databases/:alias/update-alias` - Update database alias (v0.1.0)

### Queries

- `POST /api/query` - Execute SQL query

### Database Browser

- `GET /api/browse/tables` - List all tables with row counts
- `GET /api/browse/tables/:tableName/structure` - Get table structure (columns)
- `GET /api/browse/tables/:tableName/data` - Get table data with pagination
- `GET /api/browse/tables/:tableName/info` - Get detailed table metadata
- `GET /api/browse/tables/:tableName/indexes` - Get table indexes

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

**Default JSON format:**
```json
{
  "mcpServers": {
    "mysql-mcp": {
      "type": "http",
      "url": "http://localhost:9274/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY_HERE"
      }
    }
  }
}
```

**With TOON format (per-client configuration):**
```json
{
  "mcpServers": {
    "mysql-mcp": {
      "type": "http",
      "url": "http://localhost:9274/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY_HERE",
        "X-Response-Format": "toon"
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

**TOON Format Benefits:**
- ~40% fewer tokens for tabular data
- Better Claude comprehension on structured data
- Each client can choose their preferred format via `X-Response-Format` header

#### Option 2: Stdio Mode (Let Claude Desktop Manage Server)

Use this to let Claude Desktop start and stop the server automatically:

**Default JSON format:**
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

**With TOON format (server-wide configuration):**
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
        "AUTH_TOKEN": "YOUR_API_KEY_HERE",
        "MCP_RESPONSE_FORMAT": "toon"
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
- **Connections**: MySQL server connection details (encrypted passwords, enabled status) ✨ Updated in v0.1.0
- **Databases**: Per-database permissions, custom aliases, and metadata ✨ Updated in v0.1.0
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
- `MCP_RESPONSE_FORMAT` - MCP response format: `json` (default) or `toon` (server-wide setting)
- `ENABLE_HTTPS` - Enable HTTPS (default: false)
- `SSL_CERT_PATH` - Path to SSL certificate file
- `SSL_KEY_PATH` - Path to SSL private key file
- `RATE_LIMIT_ENABLED` - Enable rate limiting (default: true)
- `RATE_LIMIT_WINDOW_MS` - Rate limit window in milliseconds (default: 900000 / 15 minutes)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

**Note**: In development HTTP mode, a default JWT secret is used if not provided. For production HTTP mode, `JWT_SECRET` must be explicitly set. Stdio mode (MCP via Claude Desktop) doesn't require JWT_SECRET as it uses API key authentication.

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed configuration examples and production setup.

## Security Features

MySQL MCP WebUI has undergone comprehensive security auditing and hardening (v0.0.6):

### Authentication & Authorization
- **Dual Authentication**: JWT-based authentication for WebUI users + API key authentication for MCP/programmatic access
- **Password Security**: bcrypt hashing (10 salt rounds) for user passwords with forced password change on first login
- **AES-256-GCM Encryption**: All MySQL database passwords are encrypted at rest
- **JWT Tokens**: httpOnly cookies with configurable expiration for secure session management
- **Constant-Time Comparison**: Prevents timing attacks on token verification
- **User Management**: Multi-user support with secure CRUD operations

### Input Validation & Query Safety
- **SQL Injection Prevention**:
  - Parameterized queries via mysql2 for all user input
  - Table name validation against actual database tables
  - Identifier escaping with backticks for dynamic table/column names
  - Maximum bounds on pagination parameters (offset, page size)
- **Permission Validation**: Query permissions are checked before execution via SQL parsing
- **Transaction Support**: All queries run in transactions with automatic rollback on error

### Infrastructure Security
- **Rate Limiting**: Configurable per-endpoint rate limiting to prevent abuse
- **HTTPS/TLS Support**: Production-ready SSL/TLS encryption for all connections
- **Security Headers**: Proper CORS, CSP, and other security headers configured
- **Dependency Security**: Regular audits and updates of all dependencies
- **Recent Security Fixes**: All CRITICAL and HIGH severity vulnerabilities patched (v0.0.6)

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
│  │  - Connections (encrypted,enabled)│        │
│  │  - Databases (aliases,permissions)│        │
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
│   │   ├── utils/    # Utility functions (TOON formatter, etc.)
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
- Full MCP server implementation with four powerful tools
- **TOON format support for token-optimized responses (~40% reduction)** ✨ ENHANCED (v0.1.4)
  - Official `@toon-format/toon` library integration for proper nested data handling
  - Indentation-based encoding, dotted-key folding, smart format detection
  - Per-client configuration via `X-Response-Format` header (HTTP mode)
  - Server-wide configuration via `MCP_RESPONSE_FORMAT` environment variable
  - TOON v2.0 spec-compliant with ongoing library maintenance
- **`add_connection` MCP tool for programmatic connection creation** ✨ NEW (v0.1.0)
- **Database aliasing system with custom user-friendly names** ✨ NEW (v0.1.0)
- **Connection enable/disable controls** ✨ NEW (v0.1.0)
- Complete REST API for connection and database management
- React-based web UI for configuration management
- Database browser with table exploration, structure viewer, and pagination (v0.0.6)
- Dark mode support with device preference detection (v0.0.6)
- Database enable/disable functionality (v0.0.6)
- Comprehensive security hardening (CRITICAL/HIGH vulnerabilities fixed) (v0.0.6)
- Dual authentication system (JWT for WebUI + API keys for MCP)
- Multi-user support with secure password management
- Request/response logging with user tracking
- Dual transport support (stdio/http)
- Multi-instance support with isolated state (stdio and HTTP modes)
- Production-ready Docker deployment
- HTTPS/TLS support with Let's Encrypt integration
- Configurable rate limiting
- Encrypted password storage
- Per-database permission management
- Safe concurrent SQLite writes with retry logic
- Session-based isolation for HTTP mode
- Monaco Editor integration for SQL queries

### Planned Features
- Role-based access control (RBAC)
- Query history and favorites with save/load functionality
- Advanced permissions (table/column level granularity)
- Query result export (CSV, JSON, Excel formats)
- Visual query builder
- Database schema diagram visualization
- Monitoring and metrics dashboard
- Query performance analysis and EXPLAIN integration
- Backup and restore management
- Query templates and snippets library
- Multi-database query support (cross-database JOINs)

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
