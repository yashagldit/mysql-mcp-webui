# MySQL MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![npm version](https://img.shields.io/badge/npm-v0.0.7-blue)](https://www.npmjs.com/package/mysql-mcp-webui)

**Give Claude AI direct access to your MySQL databases through the Model Context Protocol (MCP).**

MySQL MCP Server enables Claude Desktop and Claude Code to execute SQL queries, explore databases, and interact with your MySQL data - all through a secure, permission-controlled interface.

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io/) is an open standard that lets AI assistants like Claude securely connect to external data sources and tools. This MySQL MCP Server implements that protocol, giving Claude the ability to:

- 🔍 **Query your databases** - Execute SQL queries with natural language
- 📊 **Explore your data** - Browse tables, understand schema, and analyze data
- 🔄 **Switch contexts** - Move between different databases seamlessly
- 🔒 **Stay secure** - Every operation is validated against your permission rules

## Quick Start

### Installation

```bash
# Install globally via npm
npm install -g mysql-mcp-webui

# Or run directly with npx
npx mysql-mcp-webui
```

### Setup in 3 Steps

#### 1. Generate an API Key

```bash
mysql-mcp-webui --generate-token
```

This creates an authentication token. **Save it securely** - you'll need it for Claude Desktop.

#### 2. Configure Claude Desktop

Add this to your Claude Desktop config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "mysql-mcp-webui"],
      "env": {
        "TRANSPORT": "stdio",
        "AUTH_TOKEN": "your-api-key-here"
      }
    }
  }
}
```

Replace `your-api-key-here` with the token from step 1.

#### 3. Configure Your MySQL Connections

Open the Web UI at http://localhost:9274 (starts automatically when Claude Desktop launches the MCP server):

1. **Login** with default credentials: `admin` / `admin` (you'll be prompted to change this)
2. **Add a MySQL connection** with your database credentials
3. **Test the connection** to verify it works
4. **Discover databases** to auto-detect all available databases
5. **Set permissions** for each database (SELECT, INSERT, UPDATE, etc.)

**Restart Claude Desktop** to activate the MCP server.

## The Three MCP Tools

Once configured, Claude can use three powerful tools to interact with your MySQL databases:

### 1. `mysql_query` - Execute SQL Queries

Claude can run SQL queries against your active database with automatic permission validation.

**Example conversation:**
```
You: "Show me the top 10 users by registration date"

Claude uses: mysql_query
SQL: SELECT id, username, email, created_at
     FROM users
     ORDER BY created_at DESC
     LIMIT 10

Response: [Query results displayed as a table]
```

**What happens:**
1. Claude generates appropriate SQL based on your request
2. Query is validated against database permissions (e.g., must have SELECT permission)
3. Executes in a transaction (auto-rollback on error)
4. Results formatted for easy reading

### 2. `list_databases` - Explore Available Databases

Claude can see all databases you've configured and their permissions.

**Example conversation:**
```
You: "What databases do I have access to?"

Claude uses: list_databases
Arguments: { include_metadata: true }

Response:
- production_db (Active)
  Permissions: SELECT
  Tables: 45
  Size: 2.3 GB

- staging_db
  Permissions: SELECT, INSERT, UPDATE
  Tables: 42
  Size: 856 MB
```

**What happens:**
1. Lists all databases from your active MySQL connection
2. Shows which database is currently active
3. Displays configured permissions for each
4. Optionally includes metadata (table count, size)

### 3. `switch_database` - Change Active Database

Claude can switch between databases within your MySQL connection.

**Example conversation:**
```
You: "Let's look at the staging database instead"

Claude uses: switch_database
Arguments: { database: "staging_db" }

Response: ✓ Switched from production_db to staging_db
Permissions: SELECT, INSERT, UPDATE, DELETE
You can now query data and make modifications in staging_db
```

**What happens:**
1. Validates database exists in your connection
2. Switches active database for all future queries
3. Returns new database's permissions
4. Persists the change (survives restarts)

## How It Works

```
┌─────────────────────────────────────────────────────┐
│  You: "Show me users who signed up this month"     │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  Claude Desktop / Claude Code                       │
│  - Understands your request                         │
│  - Decides to use mysql_query tool                  │
│  - Generates appropriate SQL                        │
└──────────────────┬──────────────────────────────────┘
                   │ MCP Protocol
┌──────────────────▼──────────────────────────────────┐
│  MySQL MCP Server                                    │
│  1. Validates API token                             │
│  2. Checks database permissions                     │
│  3. Parses SQL to verify allowed operations         │
│  4. Executes query in transaction                   │
│  5. Returns results                                 │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  Your MySQL Database                                │
│  - Query executed safely                            │
│  - Results returned                                 │
└─────────────────────────────────────────────────────┘
```

## Permission System

Every database has granular permissions. Configure what Claude can do:

| Permission | What It Allows | Example Use Case |
|------------|----------------|------------------|
| **SELECT** | Read data from tables | "Show me all orders from last week" |
| **INSERT** | Add new records | "Create a new user account" |
| **UPDATE** | Modify existing records | "Update the user's email address" |
| **DELETE** | Remove records | "Delete spam comments" |
| **CREATE** | Create tables/indexes | "Create a new analytics table" |
| **ALTER** | Modify table structure | "Add a new column to users table" |
| **DROP** | Delete tables/databases | "Drop the temporary test table" |
| **TRUNCATE** | Empty tables | "Clear all data from logs table" |

**Best Practice:** Start with **SELECT only** for production databases. Grant additional permissions as needed.

## Use Cases

### Data Analysis
```
You: "What's our monthly revenue trend for the past 6 months?"
Claude: Uses mysql_query to aggregate sales data and presents a summary
```

### Database Exploration
```
You: "What tables contain customer information?"
Claude: Queries information_schema and explains table relationships
```

### Schema Understanding
```
You: "Explain the users table structure"
Claude: Uses DESCRIBE query and explains each column's purpose
```

### Data Migration
```
You: "Copy all users created this year to the archive database"
Claude: Switches databases, queries source, and inserts to destination
```

### Debugging
```
You: "Why are we getting duplicate orders?"
Claude: Queries orders table, analyzes the data, and identifies the issue
```

## Configuration Options

### Transport Modes

**stdio Mode** (Default for Claude Desktop):
```json
{
  "TRANSPORT": "stdio",
  "AUTH_TOKEN": "your-api-key"
}
```
- MCP communication via stdin/stdout
- Automatic lifecycle management by Claude
- Web UI runs on separate HTTP port (9274)

**HTTP Mode** (For Claude Code and remote access):
```bash
# Start server in HTTP mode
TRANSPORT=http mysql-mcp-webui

# Claude Code connects to:
# http://localhost:9274/mcp
```
- MCP communication via HTTP endpoint
- Supports multiple concurrent sessions
- Includes REST API and Web UI

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSPORT` | `http` | Transport mode: `stdio` or `http` |
| `HTTP_PORT` | `9274` | Web UI and API port |
| `AUTH_TOKEN` | - | API key (required for stdio mode) |
| `NODE_ENV` | `development` | Environment: `development` or `production` |

## Web UI Features

Access the management interface at **http://localhost:9274**

- **Dashboard** - Overview of connections and activity
- **Connections** - Manage MySQL server connections
- **Databases** - Configure permissions and enable/disable databases
- **Browser** - Explore tables, view data, check indexes
- **Query Editor** - Test SQL queries with syntax highlighting
- **API Keys** - Manage authentication tokens
- **Users** - Multi-user access control
- **Logs** - Audit trail of all MCP tool calls
- **Dark Mode** - System preference detection

## Security

### Built-in Protections

✅ **Permission Validation** - Every query checked against database permissions
✅ **SQL Parsing** - Validates query type before execution
✅ **Transaction Safety** - Auto-rollback on errors
✅ **Password Encryption** - AES-256-GCM for MySQL passwords
✅ **API Key Authentication** - Token-based access control
✅ **Request Logging** - Complete audit trail
✅ **Rate Limiting** - Prevent abuse
✅ **Input Sanitization** - SQL injection prevention

### Best Practices

1. **Use Read-Only Permissions** for production databases initially
2. **Create Dedicated MySQL Users** with limited privileges
3. **Rotate API Keys Regularly** via the Web UI
4. **Review Audit Logs** to monitor Claude's database access
5. **Enable Only Required Databases** - disable others
6. **Use HTTPS in Production** for remote access

## Multi-Instance Support

Run multiple Claude Desktop instances or sessions safely:

- **stdio mode**: Each Claude Desktop instance gets its own process
- **HTTP mode**: Multiple sessions with isolated state
- **Concurrent access**: Safe SQLite writes with WAL mode
- **Session cleanup**: Automatic cleanup of inactive sessions (30 min)

Set a default connection in Web UI so all new instances start with the same setup.

## Troubleshooting

### Claude can't connect to MCP server

1. Check Claude Desktop config file syntax (valid JSON)
2. Verify API key is correct: `mysql-mcp-webui --generate-token`
3. Restart Claude Desktop completely
4. Check Web UI is accessible at http://localhost:9274

### Permission denied errors

1. Open Web UI → Databases
2. Verify database has required permissions enabled
3. Check database is enabled (not disabled)
4. Ensure MySQL user has actual database permissions

### Connection errors

1. Test connection in Web UI (Connections page → Test button)
2. Verify MySQL server is running and accessible
3. Check firewall rules
4. Confirm MySQL credentials are correct

### Port already in use

```bash
# Change the default port
HTTP_PORT=3001 mysql-mcp-webui
```

## Advanced Usage

### Custom Installation Path

```json
{
  "mcpServers": {
    "mysql": {
      "command": "node",
      "args": ["/path/to/mysql-mcp-webui/server/dist/index.js"],
      "env": {
        "TRANSPORT": "stdio",
        "AUTH_TOKEN": "your-key"
      }
    }
  }
}
```

### Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for:
- Docker deployment
- HTTPS/TLS configuration
- Rate limiting setup
- Multi-instance architecture
- Security hardening

### Development

See [README_DEVELOPMENT.md](README_DEVELOPMENT.md) for:
- Architecture details
- API documentation
- Development setup
- Contributing guidelines

## CLI Commands

```bash
# Show help
mysql-mcp-webui --help

# Generate new API token
mysql-mcp-webui --generate-token

# Show version
mysql-mcp-webui --version
```

## What's New in v0.0.7

- 📖 **Enhanced Documentation** - New user-focused README with MCP workflow examples
- 🔄 **Documentation Reorganization** - Technical details moved to README_DEVELOPMENT.md
- 💡 **Better Onboarding** - Clear step-by-step setup guide with example conversations
- 📚 **Use Case Examples** - Real-world scenarios showing how Claude uses MCP tools
- 🎯 **Troubleshooting Guide** - Common issues and solutions for quick problem resolution

## Resources

- **Documentation**: [GitHub Repository](https://github.com/yashagldit/mysql-mcp-webui)
- **Issues & Support**: [GitHub Issues](https://github.com/yashagldit/mysql-mcp-webui/issues)
- **Model Context Protocol**: [modelcontextprotocol.io](https://modelcontextprotocol.io/)
- **Development Guide**: [README_DEVELOPMENT.md](README_DEVELOPMENT.md)
- **Deployment Guide**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- Powers [Claude Desktop](https://claude.ai/download) and [Claude Code](https://claude.com/code)
- Created by [Yash Agarwal](https://github.com/yashagldit)

---

**Ready to give Claude access to your databases?** Install now and start exploring your data with natural language! 🚀
