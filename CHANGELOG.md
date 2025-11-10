# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Role-based access control (RBAC)
- Query history and favorites
- Query result export (CSV, JSON, Excel)
- Visual query builder
- Database schema diagram visualization

## [0.1.0] - 2025-01-11

### Added

#### New MCP Tool: add_connection
- **`add_connection` tool** - Claude can now create MySQL connections programmatically
- Validates connection by testing credentials before saving
- Auto-discovers databases after successful connection
- Password encryption with AES-256-GCM for secure storage
- Full validation with detailed error messages
- Enhanced error messages guide users to use `add_connection` when no connections exist

#### Database Aliasing System
- **Custom database aliases** - Create user-friendly names for databases
- Alias validation with specific criteria (3-50 characters, alphanumeric, underscores, hyphens)
- Edit alias modal in Web UI for easy alias management
- Automatic unique alias generation for existing databases during migration
- MCP tools support database switching via aliases
- Database selection and queries use aliases throughout the system
- Enhanced schema with `alias` and `last_accessed` columns
- SQL query support for explicit database aliasing

#### Connection Management
- **Connection enable/disable** - Control which connections are active
- Visual indicators in UI for enabled/disabled connections
- MCP tools respect connection enabled state (prevents queries to disabled connections)
- Endpoints for toggling connection status:
  - `POST /api/connections/:id/enable` - Enable a connection
  - `POST /api/connections/:id/disable` - Disable a connection
- Enhanced schema with `enabled` column for connections
- Cascading behavior: disabling connection disables all its databases

#### API Endpoints
- `POST /api/databases/:alias/update-alias` - Update database alias
- `POST /api/connections/:id/enable` - Enable MySQL connection
- `POST /api/connections/:id/disable` - Disable MySQL connection

### Changed
- MCP handlers now use database aliases for activation and switching
- QueryExecutor updated to support explicit database aliasing in SQL queries
- Session management tracks active databases by alias
- Improved error handling when no connections are configured
- Enhanced table browser with alias support
- Database cards display both alias and actual database name
- Improved DatabaseList with connection grouping and status indicators

### Technical Details
- **Alias Validator** utility ensures aliases meet specified criteria
- Migration logic automatically generates unique aliases for existing databases
- Type definitions updated to include alias-related properties
- Tools schema updated to reflect `add_connection` tool signature
- Enhanced connection manager with enable/disable support
- Database manager implements alias uniqueness validation

## [0.0.7] - 2025-01-07

### Changed

#### Documentation Overhaul
- **New user-focused README.md** - Emphasizes MCP features, workflow, and usage
- **README_DEVELOPMENT.md** - Technical documentation for developers (renamed from original README)
- Enhanced onboarding with clear 3-step setup guide
- Added example conversations showing how Claude uses each MCP tool
- Visual flow diagram illustrating request flow from user → Claude → MCP → MySQL
- Comprehensive use case examples (data analysis, debugging, migration, etc.)
- Expanded troubleshooting section with common issues and solutions
- Better explanation of permission system with practical examples
- Clearer transport mode documentation (stdio vs HTTP)

### Fixed
- Updated version numbers across all files to 0.0.7
- Corrected version in CLI help text and --version flag

## [0.0.6] - 2025-01-07

### Added

#### Database Browser
- **New Browser page** for exploring database tables
- Table listing with row counts for all tables
- Table structure viewer (DESCRIBE table)
- Paginated data browsing with configurable page sizes (max 1000 rows per page)
- Table metadata viewer (engine, collation, size, auto_increment, etc.)
- Index viewer for tables
- View detection and handling (separate from base tables)
- SQL injection protection with table name validation

#### Dark Mode
- Comprehensive dark mode theme across all pages and components
- Device preference detection (auto-detects system theme)
- Theme toggle in UI with persistence
- Proper contrast ratios for accessibility
- Dark mode support for Monaco Editor

#### Database Management
- Database enable/disable functionality
- Visual indicators for enabled/disabled databases
- MCP tools respect database enabled state
- Prevents queries to disabled databases via MCP

#### Security Hardening
- **Fixed all CRITICAL and HIGH severity vulnerabilities**
- Enhanced SQL injection prevention in browse API:
  - Table name validation against actual database tables
  - Identifier escaping with backticks
  - Maximum bounds on pagination parameters (offset: 1M, page size: 1000)
  - Literal string escaping in WHERE clauses
- Improved input validation across all endpoints
- Security audit documentation
- Updated dependencies to patched versions

#### API Endpoints
- `GET /api/browse/tables` - List all tables with row counts
- `GET /api/browse/tables/:tableName/structure` - Get table columns
- `GET /api/browse/tables/:tableName/data` - Browse table data with pagination
- `GET /api/browse/tables/:tableName/info` - Get table metadata
- `GET /api/browse/tables/:tableName/indexes` - Get table indexes
- `PUT /api/connections/:connId/databases/:dbName/enable` - Enable database
- `PUT /api/connections/:connId/databases/:dbName/disable` - Disable database

#### UI Improvements
- Improved responsiveness across all components
- Better accessibility with proper ARIA labels
- Enhanced mobile support
- Improved table layouts and data display
- Better error messages and user feedback

### Changed
- **Default HTTP port changed from 3000 to 9274** across entire application
- Improved table row counting (uses accurate COUNT(*) instead of estimates)
- Enhanced browse API with better performance for large datasets
- Updated documentation with security best practices

### Fixed
- Security vulnerabilities in dependencies
- Table row count accuracy issues
- Dark mode contrast issues
- Mobile responsiveness issues
- SQL injection vulnerabilities in dynamic queries

## [0.0.5] - 2025-01-06

### Added

#### User Authentication & Multi-User Support
- **Dual authentication system**: JWT for WebUI users + API keys for MCP/programmatic access
- Username/password login for WebUI with secure password hashing (bcrypt, 10 salt rounds)
- Default admin account (username: `admin`, password: `admin`) with forced password change on first login
- JWT token-based sessions with httpOnly cookies for enhanced security
- User management interface with full CRUD operations
- Secure password change flow with current password validation
- Admin password reset capability

#### Backend
- Authentication endpoints (`/api/auth`):
  - `POST /login` - Login with username/password or API token
  - `POST /logout` - Logout and clear JWT cookie
  - `GET /me` - Get current user information
  - `POST /change-password` - Change user password
  - `POST /check-token` - Validate API token
- User management endpoints (`/api/users`):
  - Full CRUD operations for user accounts
  - Admin password reset functionality
  - User activation/deactivation
- Users table in SQLite database with hashed passwords
- JWT authentication utilities (`server/src/config/auth-utils.ts`)
- Updated auth middleware for dual authentication (JWT cookie → JWT header → API key header)
- User tracking in request logs with optional `user_id` field
- Environment variables: `JWT_SECRET` (32+ chars, optional in dev HTTP mode), `JWT_EXPIRES_IN` (default: 7d)

#### Frontend
- Login modal with tabs for username/password vs API token authentication
- Password change modal with forced change support
- Enhanced AuthContext with dual authentication modes and user state
- Cookie-based session management (httpOnly, secure, sameSite)
- User profile display and management

#### Security
- bcrypt password hashing with configurable salt rounds
- JWT tokens with configurable expiration (default: 7 days)
- httpOnly cookies prevent XSS attacks on tokens
- Forced password change on first login for default admin
- Constant-time password comparison
- Separate authentication flows for WebUI (JWT) and MCP (API keys)

### Changed
- Auth middleware now supports three authentication methods in priority order:
  1. JWT from httpOnly cookie
  2. JWT from Authorization header
  3. API key from Authorization header
- Request logging now captures both API key usage (MCP) and user actions (WebUI)
- JWT_SECRET only required for HTTP mode, not stdio mode (MCP uses API keys)
- Removed localhost authentication bypass for improved security

### Technical Details
- **Backward compatible**: Existing API key authentication for MCP tools remains unchanged
- **Stdio mode**: Uses AUTH_TOKEN (API key) only, no JWT required
- **HTTP mode**: Supports both JWT (for WebUI) and API keys (for programmatic access)
- **Development mode**: Auto-generates default JWT secret with warning
- **Production mode**: Requires explicit JWT_SECRET environment variable

## [0.0.4] - 2025-01-05

### Added

#### Multi-Instance Support (v3.0)
- **Session Manager** for HTTP mode with isolated session state
- Multiple concurrent MCP instances with proper isolation:
  - **stdio mode**: Process-level isolation with in-memory active state
  - **HTTP mode**: Session-based isolation with automatic cleanup (30 min)
- Default connection management (separate from active connection per instance)
- In-memory active connection/database state in ConnectionManager
- SQLite WAL mode + busy_timeout for concurrent writes
- Exponential backoff retry logic for SQLite write conflicts
- Atomic initialization for API keys and master key

#### Production Features
- **HTTPS/TLS support** with Let's Encrypt integration
- SSL certificate loading from filesystem
- **Configurable rate limiting** middleware
  - Global rate limits (100 requests per 15 min)
  - Query endpoint limits (30 per minute)
  - Per-API key tracking
- **Environment configuration module** with validation
- Health check endpoint at `/api/health`

#### Docker Support
- Dockerfile for containerized deployment
- docker-compose.yml for easy orchestration
- .dockerignore for optimized builds
- Volume support for persistent data
- Environment variable configuration

#### API Endpoints
- `POST /api/connections/:id/set-default` - Set default connection for new instances
- `GET /api/connections/default` - Get current default connection
- `POST /api/connections/:id/activate` - Deprecated (use set-default)

#### Configuration
- Environment variables for HTTPS/TLS:
  - `ENABLE_HTTPS` - Enable HTTPS
  - `SSL_CERT_PATH` - Path to SSL certificate
  - `SSL_KEY_PATH` - Path to SSL private key
- Environment variables for rate limiting:
  - `RATE_LIMIT_ENABLED` - Enable rate limiting (default: true)
  - `RATE_LIMIT_WINDOW_MS` - Window in ms (default: 900000)
  - `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

#### Documentation
- Comprehensive DEPLOYMENT.md guide
- Multi-instance deployment instructions
- HTTPS setup with Let's Encrypt
- Security best practices
- Troubleshooting guide

### Changed
- Active connection state moved from SQLite to in-memory (ConnectionManager)
- DatabaseManager implements retry logic for concurrent SQLite writes
- MCP handlers detect transport mode and use appropriate state management
- Connection manager uses lazy initialization with proper cleanup
- Improved error handling for concurrent database access

### Technical Details
- **Process isolation** (stdio): Each Claude Desktop spawns separate process with own state
- **Session isolation** (HTTP): Single container serves multiple sessions with isolated state
- **Shared storage**: SQLite database stores connections, permissions, API keys, logs
- **Safe concurrency**: WAL mode + retries ensure safe concurrent SQLite access

## [0.0.3] - 2025-01-04

### Added
- npm publish workflow for automated releases
- Package configuration for npm registry
- bin entry point for global installation
- Files whitelist for npm package

### Changed
- Package version bumped to 0.0.3
- Updated repository URLs and metadata

## [0.0.2] - 2025-01-03

### Added
- Initial project structure with monorepo setup
- Basic MCP server implementation
- SQLite-based configuration storage
- React frontend scaffolding

## [1.0.0] - 2025-01-XX

### Added

#### Backend
- MCP server implementation with three core tools:
  - `mysql_query`: Execute SQL queries with permission validation
  - `list_databases`: List databases with permissions and metadata
  - `switch_database`: Switch active database dynamically
- Dual transport support (stdio and HTTP modes)
- Connection manager with MySQL connection pooling
- Query executor with automatic transaction support
- Permission validator with 8 operation types (SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE)
- Database discovery service for automatic database detection
- AES-256-GCM password encryption for MySQL credentials
- Multi-API key authentication system
- Request/response logging for audit trails
- SQLite-based configuration storage (replaced JSON file)

#### REST API
- Connection management endpoints (CRUD operations)
- Database management endpoints
- Query execution endpoint
- API key management endpoints
- Settings management endpoints
- Request log retrieval endpoints
- Health check endpoint

#### Frontend
- React 18-based web UI
- Connection management interface
- Database explorer and permissions panel
- SQL editor with Monaco Editor
- Query results display with pagination
- API key management interface
- Request logs viewer
- Settings configuration panel
- Responsive design with TailwindCSS
- Dark mode support
- Real-time connection testing
- Database discovery interface

#### Security
- Token-based authentication for all API/MCP requests
- Constant-time comparison for token verification
- Encrypted password storage at rest
- SQL injection prevention via parameterized queries
- Per-database permission enforcement
- Transaction-based query execution with rollback

#### Developer Experience
- TypeScript throughout (backend and frontend)
- Comprehensive type definitions
- Zod schema validation
- React Query for state management
- Modular architecture with clear separation of concerns
- Development mode with hot reload
- Production build optimization

### Changed
- Migrated from JSON configuration to SQLite database (v2.0)
- Replaced single server token with multi-API key system
- Enhanced logging system with structured request/response tracking
- Improved error handling and user feedback

### Security
- All MySQL passwords encrypted with AES-256-GCM
- Master encryption key stored separately
- Token authentication required for all operations
- Permission validation before query execution

## Migration Guide

### Upgrading to v0.0.6

**Security Update:**
- All dependencies updated to patch CRITICAL/HIGH vulnerabilities
- No breaking changes
- Recommended to update immediately

**New Features:**
- Access the new Database Browser at `/browser` in the Web UI
- Toggle dark mode in the UI (respects system preference by default)
- Enable/disable databases in the Databases page

### Upgrading to v0.0.5 (User Authentication)

**Breaking Changes:**
- Login now required for Web UI access
- Default credentials: `admin` / `admin` (you'll be forced to change on first login)

**Migration Steps:**
1. Update to v0.0.5
2. Access Web UI (will prompt for login)
3. Login with `admin` / `admin`
4. Change password when prompted
5. Create additional user accounts as needed

### Upgrading to v0.0.4 (Multi-Instance Support)

**Breaking Changes:**
- Active connection no longer stored in SQLite (moved to in-memory)
- Session-based state for HTTP mode

**Migration Steps:**
1. Update to v0.0.4
2. Set default connection in Web UI (optional)
3. Restart all MCP instances
4. Verify connections work correctly

**New Environment Variables:**
- `ENABLE_HTTPS` - Enable HTTPS/TLS (default: false)
- `SSL_CERT_PATH` - Path to SSL certificate
- `SSL_KEY_PATH` - Path to SSL private key
- `RATE_LIMIT_ENABLED` - Enable rate limiting (default: true)
- `RATE_LIMIT_WINDOW_MS` - Rate limit window (default: 900000)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

### Port Change (v0.0.6)

**Important:** Default HTTP port changed from 3000 to 9274

**Update Required For:**
- Docker deployments: Update port mappings
- Environment variables: Update `HTTP_PORT` if explicitly set to 3000
- MCP client configs: Update URL from `http://localhost:3000` to `http://localhost:9274`
- Firewall rules: Update allowed ports

### Transport Mode

The `TRANSPORT` environment variable supports:
- `http` (default): Run as HTTP server
- `stdio`: Run in stdio mode for direct Claude Desktop integration

---

## Version History Summary

- **v0.1.0** (2025-01-11) - Database aliasing, connection management, add_connection tool
- **v0.0.7** (2025-01-07) - Documentation overhaul, user-focused README, MCP workflow examples
- **v0.0.6** (2025-01-07) - Database browser, dark mode, security hardening, port change to 9274
- **v0.0.5** (2025-01-06) - User authentication, JWT tokens, multi-user support
- **v0.0.4** (2025-01-05) - Multi-instance support, HTTPS/TLS, rate limiting, Docker
- **v0.0.3** (2025-01-04) - npm publish workflow, package configuration
- **v0.0.2** (2025-01-03) - Initial project structure
- **v1.0.0** (Planned) - Stable release with RBAC, query history, advanced features

---

## Breaking Changes Summary

### v0.0.6
- **Port change**: Default HTTP port changed from 3000 to 9274 (update all configurations)

### v0.0.5
- **Authentication required**: Web UI now requires login (default: admin/admin)
- **JWT secrets**: Production HTTP mode requires `JWT_SECRET` environment variable

### v0.0.4
- **Active state**: Active connection/database moved from SQLite to in-memory
- **Session-based**: HTTP mode uses session isolation (may affect existing clients)

---

For more details about changes, see the [commit history](https://github.com/yashagldit/mysql-mcp-webui/commits/main).
