# MySQL MCP WebUI

A MySQL MCP (Model Context Protocol) server with a React-based web UI for live configuration management.

## Features

- **Web UI for Configuration**: Manage MySQL connections, databases, and permissions through an intuitive web interface
- **Auto-Discovery**: Automatically discovers databases from MySQL server connections
- **Per-Database Permissions**: Fine-grained control over 8 different operation types (SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE)
- **Live Database Switching**: Switch between databases without restarting the server
- **Dual Transport Support**: Works with both stdio and HTTP transports
- **MCP Tools**: Three powerful tools for Claude to interact with your MySQL databases
- **Secure**: AES-256-GCM password encryption, token-based authentication
- **Multiple Connections**: Manage multiple MySQL server connections from a single interface

## Project Status

### ✅ Completed (Backend - Phase 1)

- [x] Project setup and structure
- [x] TypeScript configuration
- [x] Configuration manager with JSON persistence
- [x] Password encryption/decryption (AES-256-GCM)
- [x] Connection manager with pooling
- [x] Database discovery service
- [x] Permission validator
- [x] Query executor with transaction support
- [x] MCP server with tool definitions
- [x] REST API routes (connections, databases, queries, settings)
- [x] Express HTTP server setup
- [x] Authentication middleware
- [x] Server successfully compiles

### 🚧 In Progress

- [ ] Frontend React application
- [ ] Testing and validation
- [ ] Documentation completion

### 📋 Upcoming

- [ ] End-to-end testing
- [ ] Production deployment setup
- [ ] Performance optimization
- [ ] Advanced features (query history, favorites, etc.)

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
- `POST /api/connections/:id/activate` - Switch to connection
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

## Configuration

Configuration is stored in `/config/config.json`:

```json
{
  "serverToken": "generated-secure-token",
  "transport": "http",
  "httpPort": 3000,
  "connections": {},
  "activeConnection": "conn_id"
}
```

### Environment Variables

- `TRANSPORT` - Transport mode: `stdio` or `http` (default: from config)
- `HTTP_PORT` - HTTP server port (default: 3000)
- `AUTH_TOKEN` - Authentication token (required for stdio mode)
- `NODE_ENV` - Environment: `development` or `production`

## Security Features

- **AES-256-GCM Encryption**: All database passwords are encrypted at rest
- **Token Authentication**: Secure token-based authentication for all API and MCP requests
- **Permission Validation**: Query permissions are checked before execution
- **Transaction Support**: All queries run in transactions with automatic rollback on error
- **SQL Injection Prevention**: Uses parameterized queries via mysql2
- **Constant-Time Comparison**: Prevents timing attacks on token verification

## Architecture

```
┌─────────────────────────────────────────────┐
│         MCP Client (Claude)                  │
└────────────────┬────────────────────────────┘
                 │ MCP Protocol
┌────────────────▼────────────────────────────┐
│         MySQL MCP WebUI Server               │
│                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   MCP    │  │ REST API │  │ Web UI   │  │
│  │  Tools   │  │          │  │ (React)  │  │
│  └────┬─────┘  └────┬─────┘  └──────────┘  │
│       │             │                        │
│  ┌────▼─────────────▼──────────────┐        │
│  │    Connection Manager            │        │
│  │    Query Executor                │        │
│  │    Permission Validator          │        │
│  │    Config Manager                │        │
│  └────────────────┬─────────────────┘        │
└───────────────────┼──────────────────────────┘
                    │ MySQL Protocol
          ┌─────────▼─────────┐
          │   MySQL Server    │
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

### Frontend (Upcoming)
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
├── client/           # Frontend (in progress)
│   └── src/
└── config/           # Runtime configuration
    └── config.json
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

### Phase 1: Backend Foundation ✅
- Core backend infrastructure
- MCP server implementation
- REST API
- Database layer

### Phase 2: Frontend (In Progress)
- React application setup
- Connection management UI
- Database management UI
- Permissions panel
- Query tester
- Settings page

### Phase 3: Testing & Polish
- Unit tests
- Integration tests
- E2E tests
- Performance optimization
- Documentation

### Phase 4: Advanced Features
- Query history
- Favorite queries
- Advanced permissions (table/column level)
- Monitoring and metrics
- Multi-user support

## License

MIT

## Contributing

Contributions are welcome! Please see [PLAN.md](PLAN.md) for detailed architecture and [TODO.md](TODO.md) for task tracking.
