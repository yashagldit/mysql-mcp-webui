# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MySQL MCP WebUI is a dual-purpose system that implements the Model Context Protocol (MCP) to enable Claude AI to interact with MySQL databases while providing a React-based web UI for configuration management. The project has two distinct but interconnected functionalities:

1. **MCP Server**: Exposes three tools (mysql_query, list_databases, switch_database) for Claude to interact with MySQL
2. **Web UI**: React application for managing connections, databases, permissions, and API keys

## Commands

### Building
```bash
# Build both client and server (client builds first, then server)
npm run build

# Build server only
npm run build:server

# Build client only
npm run build:client
```

### Development
```bash
# Run both server and client in development mode
npm run dev

# Run server only (with hot reload)
npm run dev:server

# Run client only (Vite dev server)
npm run dev:client
```

### Running
```bash
# Start in HTTP mode (default, port 3000)
npm run start:http

# Start in stdio mode (for Claude Desktop direct integration)
npm run start:stdio

# Custom configurations
TRANSPORT=http HTTP_PORT=3001 node server/dist/index.js
NODE_ENV=production TRANSPORT=http HTTP_PORT=3003 node server/dist/index.js
```

## Architecture

### Workspace Structure

This is a monorepo with npm workspaces:
- `/server` - Node.js/TypeScript backend
- `/client` - React/TypeScript frontend
- `/data` - SQLite database for configuration storage

### Critical Architecture Patterns

**1. Singleton Database Managers**

All data access flows through singleton instances:
- `getDatabaseManager()` - SQLite config database access (replaced ConfigManager in v2.0)
- `getConnectionManager()` - MySQL connection pooling with lazy initialization

Never instantiate these directly; always use the getter functions.

**2. Dual Transport MCP Server**

The MCP server supports two transport modes set via `TRANSPORT` environment variable:
- **stdio**: Direct IPC with Claude Desktop (server lifecycle managed by Claude)
- **http**: REST endpoint at `/mcp` (server runs independently)

The transport mode is determined at startup in [server/src/index.ts](server/src/index.ts) and affects authentication flow and server initialization.

**3. Query Execution Flow**

All SQL queries follow this pipeline:
```
Request → Auth Middleware → Logging Middleware → Permission Validator → Query Executor → MySQL
```

Key files:
- [server/src/db/query-executor.ts](server/src/db/query-executor.ts) - Executes queries in transactions
- [server/src/db/permissions.ts](server/src/db/permissions.ts) - Validates query against database permissions
- [server/src/api/middleware/auth.ts](server/src/api/middleware/auth.ts) - Token authentication

**4. Transaction-Based Execution**

All queries execute within MySQL transactions with automatic rollback on error:
- SELECT queries: Read-only transaction
- Modifying queries: Full transaction with commit/rollback
- Implemented in `executeQuery()` method of QueryExecutor

**5. Configuration Storage (v2.0 Migration)**

The project migrated from JSON file config to SQLite database in v2.0:
- **Old**: config.json with single server token
- **New**: data/mysql-mcp.db with multi-API key system, request logs, and structured schema
- DatabaseManager ([server/src/db/database-manager.ts](server/src/db/database-manager.ts)) is the central data access layer (600+ lines)

### Security Architecture

**Password Encryption**
- All MySQL passwords encrypted at rest using AES-256-GCM
- Master key stored in [data/master.key](data/master.key)
- Encryption/decryption in [server/src/config/crypto.ts](server/src/config/crypto.ts)

**Authentication**
- Multi-API key system (v2.0)
- Token-based authentication for all API and MCP requests
- Constant-time comparison prevents timing attacks
- Localhost bypass available in development mode

**Permission Validation**
- Per-database, per-operation permissions (SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE)
- SQL parsing via node-sql-parser to extract operation type
- Validation occurs before query execution

## Key Files for Understanding

### Backend Core
- [server/src/index.ts](server/src/index.ts) - Application entry point and transport mode selection
- [server/src/http-server.ts](server/src/http-server.ts) - Express app setup and middleware chain
- [server/src/db/database-manager.ts](server/src/db/database-manager.ts) - Central data access layer (replaces old ConfigManager)
- [server/src/mcp/handlers.ts](server/src/mcp/handlers.ts) - MCP tool implementations
- [server/src/mcp/server.ts](server/src/mcp/server.ts) - MCP server factory with transport-specific setup

### Frontend Core
- [client/src/App.tsx](client/src/App.tsx) - React app structure with routing
- [client/src/api/client.ts](client/src/api/client.ts) - Axios API client singleton with auth interceptor
- [client/src/contexts/AuthContext.tsx](client/src/contexts/AuthContext.tsx) - Authentication state management

## REST API Structure

The API follows consistent response format:
```typescript
{ success: boolean, data?: T, error?: string }
```

API routes are organized by feature in [server/src/api/routes/](server/src/api/routes/):
- `connections.ts` - Connection CRUD and testing
- `databases.ts` - Database listing and permissions
- `query.ts` - SQL query execution
- `api-keys.ts` - API key management (v2.0)
- `logs.ts` - Request log retrieval (v2.0)
- `settings.ts` - Server configuration

## Frontend Data Flow

React Query hooks in [client/src/hooks/](client/src/hooks/) wrap API calls:
- Components use custom hooks (e.g., `useConnections()`, `useDatabases()`)
- Hooks use `@tanstack/react-query` for caching and state management
- API client in [client/src/api/client.ts](client/src/api/client.ts) handles all HTTP requests
- Authentication context provides API key across the app

## Environment Variables

- `TRANSPORT` - Transport mode: `stdio` or `http` (default: http)
- `HTTP_PORT` - HTTP server port (default: 3000)
- `AUTH_TOKEN` - Authentication token (required for stdio mode)
- `NODE_ENV` - Environment: `development` or `production`

In development, the client runs on port 5173 (Vite) and proxies API requests to the server on port 3000.

## Important Conventions

### Backend
- Async/await throughout, no callbacks
- Zod schemas for request validation
- Try-catch with descriptive error messages
- All database access through DatabaseManager, never direct SQLite calls
- Module exports use singleton getters for managers

### Frontend
- Functional components with hooks
- Type-only imports use `import type`
- TailwindCSS utility classes for styling
- React Query for server state, Context for client state
- Centralized API calls in api/client.ts

## MCP Tools Implementation

The three MCP tools are defined in [server/src/mcp/tools.ts](server/src/mcp/tools.ts) and implemented in [server/src/mcp/handlers.ts](server/src/mcp/handlers.ts):

1. **mysql_query** - Executes SQL with permission validation
2. **list_databases** - Lists databases with permissions and optional metadata
3. **switch_database** - Changes active database and persists to config

Tool handlers receive database and connection managers as dependencies (dependency injection pattern).

## Recent Changes (v2.0)

- Migrated from JSON config file to SQLite database
- Replaced single server token with multi-API key system
- Added comprehensive request/response logging with log retrieval API
- Replaced ConfigManager class with DatabaseManager class
- Enhanced schema in [server/src/db/schema.ts](server/src/db/schema.ts)
