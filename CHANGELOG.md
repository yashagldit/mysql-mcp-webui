# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial public release preparation
- MIT License
- Contributing guidelines
- Code of Conduct
- Security policy
- Comprehensive README documentation

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

### From JSON Config to SQLite (v1.x to v2.0)

If upgrading from an earlier version using `config.json`:

1. Backup your existing `config.json`
2. Install and build the new version
3. The application will automatically migrate your configuration to SQLite on first run
4. Verify your connections and databases in the web UI
5. Update your API keys (old server token will be migrated as the first API key)

### Transport Mode Changes

The `TRANSPORT` environment variable now supports:
- `http` (default): Run as HTTP server
- `stdio`: Run in stdio mode for direct Claude Desktop integration

Update your environment configuration accordingly.

---

## Version History Summary

- **1.0.0** - Initial stable release with full MCP server, REST API, and React web UI
- **2.0.0** (internal) - Migration to SQLite, multi-API key system, enhanced logging

---

For more details about changes, see the [commit history](https://github.com/yashagldit/mysql-mcp-webui/commits/main).
