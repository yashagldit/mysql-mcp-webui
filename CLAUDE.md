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
# Start in HTTP mode (default, port 9274)
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
- `getConnectionManager()` - MySQL connection pooling with lazy initialization and in-memory active state
- `getSessionManager()` - HTTP session tracking for multi-instance support (v3.0)

Never instantiate these directly; always use the getter functions. Each process gets its own singleton instances, providing process-level isolation in stdio mode.

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

**6. Multi-Instance Support (v3.0)**

The system supports multiple concurrent instances with isolated state:

**stdio Mode (Process Isolation):**
- Each Claude Desktop instance spawns a separate Node.js process
- Each process has its own singleton manager instances
- Active connection/database tracked in-memory per process (ConnectionManager)
- SQLite writes use WAL mode + busy_timeout + exponential backoff retry logic
- Shared database stores: connections, permissions, API keys, logs
- **Use case**: Multiple Claude Desktop instances on same machine

**HTTP Mode (Session Isolation):**
- Single Docker container serves multiple HTTP clients
- SessionManager tracks active connection/database per session ID
- Sessions auto-cleanup after 30 minutes of inactivity
- MCP handlers detect session ID and route to appropriate state
- **Use case**: Multiple Claude Code instances connecting remotely

**Dual-Mode Handler Pattern:**
```typescript
// MCP handlers auto-detect mode and delegate appropriately
if (this.transportMode === 'http' && this.currentSessionId) {
  // Use session-based state
  return this.sessionManager.getActiveConnection(this.currentSessionId);
} else {
  // Use process-based state
  return this.connectionManager.getActiveConnectionId();
}
```

**Default Connection Management:**
- Web UI can set "default connection" via `setDefaultConnectionId()`
- New instances start with this default connection
- Running instances are NOT affected (isolated state preserved)
- Enables coordination without disrupting active sessions

Key files:
- [server/src/mcp/session-manager.ts](server/src/mcp/session-manager.ts) - HTTP session tracking
- [server/src/db/connection-manager.ts](server/src/db/connection-manager.ts) - In-memory active state for stdio mode
- [server/src/mcp/handlers.ts](server/src/mcp/handlers.ts) - Dual-mode handler logic with setSession()

### Security Architecture

**Password Encryption**
- All MySQL passwords encrypted at rest using AES-256-GCM
- Master key stored in [data/master.key](data/master.key)
- Encryption/decryption in [server/src/config/crypto.ts](server/src/config/crypto.ts)

**User Authentication (v3.1)**
- Dual authentication: JWT for WebUI users + API keys for MCP/programmatic access
- User passwords hashed with bcrypt (10 salt rounds)
- JWT tokens stored in httpOnly cookies with configurable expiration
- Forced password change on first login for default admin account
- Secure password change flow with current password validation

**Authentication Flow**
- Multi-API key system for MCP tools and programmatic access (v2.0)
- JWT authentication for WebUI user logins (v3.1)
- Auth middleware tries: JWT cookie → JWT header → API key header
- Constant-time comparison prevents timing attacks
- No localhost bypass (always requires authentication for security)

**Permission Validation**
- Per-database, per-operation permissions (SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE)
- SQL parsing via node-sql-parser to extract operation type
- Validation occurs before query execution

## Key Files for Understanding

### Backend Core
- [server/src/index.ts](server/src/index.ts) - Application entry point and transport mode selection
- [server/src/http-server.ts](server/src/http-server.ts) - Express app setup and middleware chain
- [server/src/db/database-manager.ts](server/src/db/database-manager.ts) - Central data access layer with retry logic (v3.0)
- [server/src/db/connection-manager.ts](server/src/db/connection-manager.ts) - MySQL pooling + in-memory active state (v3.0)
- [server/src/mcp/session-manager.ts](server/src/mcp/session-manager.ts) - HTTP session tracking (v3.0)
- [server/src/mcp/handlers.ts](server/src/mcp/handlers.ts) - MCP tool implementations with dual-mode support (v3.0)
- [server/src/mcp/server.ts](server/src/mcp/server.ts) - MCP server factory with transport-specific setup

### Configuration & Security
- [server/src/config/environment.ts](server/src/config/environment.ts) - Centralized environment variable validation (v3.0)
- [server/src/config/auth-utils.ts](server/src/config/auth-utils.ts) - JWT and password hashing utilities (v3.1)
- [server/src/config/tls.ts](server/src/config/tls.ts) - HTTPS/TLS certificate loading (v3.0)
- [server/src/api/middleware/rate-limit.ts](server/src/api/middleware/rate-limit.ts) - Rate limiting middleware (v3.0)
- [server/src/api/middleware/auth.ts](server/src/api/middleware/auth.ts) - Dual authentication middleware (v3.1)
- [server/src/api/routes/auth.ts](server/src/api/routes/auth.ts) - Authentication endpoints (v3.1)
- [server/src/api/routes/users.ts](server/src/api/routes/users.ts) - User management endpoints (v3.1)

### Frontend Core
- [client/src/App.tsx](client/src/App.tsx) - React app structure with routing
- [client/src/api/client.ts](client/src/api/client.ts) - Axios API client with cookie support (v3.1)
- [client/src/components/Auth/AuthContext.tsx](client/src/components/Auth/AuthContext.tsx) - Dual authentication state management (v3.1)
- [client/src/components/Auth/AuthModal.tsx](client/src/components/Auth/AuthModal.tsx) - Login modal with username/password and token tabs (v3.1)
- [client/src/components/Auth/ChangePasswordModal.tsx](client/src/components/Auth/ChangePasswordModal.tsx) - Password change with forced change support (v3.1)

## REST API Structure

The API follows consistent response format:
```typescript
{ success: boolean, data?: T, error?: string }
```

API routes are organized by feature in [server/src/api/routes/](server/src/api/routes/):
- `auth.ts` - User authentication (login, logout, change-password, me) (v3.1)
- `users.ts` - User management CRUD operations (v3.1)
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
- API client in [client/src/api/client.ts](client/src/api/client.ts) handles all HTTP requests with cookie support
- AuthContext provides dual authentication: JWT (username/password) or API token (v3.1)
- JWT tokens stored in httpOnly cookies, API tokens in Authorization headers
- User state managed in AuthContext with login/logout/refreshUser methods

## Environment Variables

**Core Configuration:**
- `TRANSPORT` - Transport mode: `stdio` or `http` (default: http)
- `HTTP_PORT` - HTTP server port (default: 3000)
- `NODE_ENV` - Environment: `development` or `production`
- `AUTH_TOKEN` - API key for authentication (required for stdio mode only)

**JWT Authentication (v3.1 - HTTP mode only):**
- `JWT_SECRET` - Secret for JWT token signing (32+ characters, optional in HTTP development, not used in stdio mode)
- `JWT_EXPIRES_IN` - JWT token expiration time (default: 7d, examples: 1h, 24h, 30d)

**HTTPS/TLS (v3.0):**
- `ENABLE_HTTPS` - Enable HTTPS (default: false)
- `SSL_CERT_PATH` - Path to SSL certificate file
- `SSL_KEY_PATH` - Path to SSL private key file

**Rate Limiting (v3.0):**
- `RATE_LIMIT_ENABLED` - Enable rate limiting (default: true)
- `RATE_LIMIT_WINDOW_MS` - Rate limit window in milliseconds (default: 900000 / 15 minutes)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

All environment variables are validated at startup in [server/src/config/environment.ts](server/src/config/environment.ts).

**Note**: JWT authentication is only used in HTTP mode for WebUI user logins. Stdio mode (MCP) uses API key authentication via AUTH_TOKEN.

In development, the client runs on port 5173 (Vite) and proxies API requests to the server on port 9274.

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

## Recent Changes

### v3.1 - User Authentication & Multi-User Support

**Dual Authentication System:**
- Added JWT-based username/password authentication for WebUI ([server/src/config/auth-utils.ts](server/src/config/auth-utils.ts))
- Implemented bcrypt password hashing with 10 salt rounds
- Created users table in SQLite with secure password storage
- Maintained API key authentication for MCP tools (backward compatible)
- JWT tokens stored in httpOnly cookies for session management

**User Management:**
- Default admin/admin credentials with forced password change on first login
- Full CRUD operations for user management via `/api/users` endpoints
- Secure password change flow with current password validation
- Admin password reset capability

**Backend Implementation:**
- Added auth routes: login, logout, change-password, me ([server/src/api/routes/auth.ts](server/src/api/routes/auth.ts))
- Added user routes: full CRUD operations ([server/src/api/routes/users.ts](server/src/api/routes/users.ts))
- Updated auth middleware for dual authentication (JWT cookie, JWT header, or API key) ([server/src/api/middleware/auth.ts](server/src/api/middleware/auth.ts))
- Added user tracking to request logs with optional `user_id` field
- JWT_SECRET only required for HTTP mode, not stdio mode (MCP uses API keys)

**Frontend Implementation:**
- Updated AuthModal with tabs for username/password vs API token login
- Added ChangePasswordModal with forced change support ([client/src/components/Auth/ChangePasswordModal.tsx](client/src/components/Auth/ChangePasswordModal.tsx))
- Enhanced AuthContext for dual login modes and user state management
- Cookie-based authentication with axios withCredentials support

**Configuration:**
- `JWT_SECRET` environment variable (32+ characters, optional in development HTTP mode)
- `JWT_EXPIRES_IN` environment variable (default: 7d)
- Auto-generates default JWT secret in development, required in production HTTP mode
- Stdio mode doesn't use JWT (uses API key authentication only)

### v3.0 - Multi-Instance Support & Production Features

**Multi-Instance Architecture:**
- Added session-based isolation for HTTP mode ([server/src/mcp/session-manager.ts](server/src/mcp/session-manager.ts))
- Added in-memory active connection state to ConnectionManager for stdio mode isolation
- Implemented dual-mode handler pattern in MCP handlers with automatic detection
- Added SQLite retry logic with exponential backoff for concurrent writes
- Enabled WAL mode and busy_timeout for safe concurrent SQLite access
- Fixed initialization races for API keys and master key with atomic operations
- Added default connection management (separate from active connection per instance)

**Production Deployment:**
- Added HTTPS/TLS support with certificate loading ([server/src/config/tls.ts](server/src/config/tls.ts))
- Implemented configurable rate limiting middleware ([server/src/api/middleware/rate-limit.ts](server/src/api/middleware/rate-limit.ts))
- Created environment configuration module with validation ([server/src/config/environment.ts](server/src/config/environment.ts))
- Added Docker support (Dockerfile, docker-compose.yml, .dockerignore)
- Created comprehensive deployment documentation ([DEPLOYMENT.md](DEPLOYMENT.md))

**API Updates:**
- Added `/api/connections/:id/set-default` endpoint
- Added `/api/connections/default` GET endpoint
- Deprecated `/api/connections/:id/activate` (backwards compatible)

### v2.0 - SQLite Migration

- Migrated from JSON config file to SQLite database
- Replaced single server token with multi-API key system
- Added comprehensive request/response logging with log retrieval API
- Replaced ConfigManager class with DatabaseManager class
- Enhanced schema in [server/src/db/schema.ts](server/src/db/schema.ts)
