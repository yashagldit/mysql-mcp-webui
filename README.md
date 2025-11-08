# MySQL MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![npm version](https://img.shields.io/badge/npm-v0.0.9-blue)](https://www.npmjs.com/package/mysql-mcp-webui)

**Give Claude AI direct access to your MySQL databases through the Model Context Protocol (MCP).**

MySQL MCP Server enables Claude Desktop and Claude Code to execute SQL queries, explore databases, and interact with your MySQL data - all through a secure, permission-controlled interface.

## Table of Contents

- [What is MCP?](#what-is-mcp)
- [Quick Start](#quick-start)
- [Setup Guide for Claude Desktop](#setup-guide-for-claude-desktop)
- [Setup Guide for Claude Code (HTTP Mode)](#setup-guide-for-claude-code-http-mode)
- [The Three MCP Tools](#the-three-mcp-tools)
- [How It Works](#how-it-works)
- [Permission System](#permission-system)
- [Use Cases](#use-cases)
- [Configuration Options](#configuration-options)
- [Web UI Features](#web-ui-features)
- [Security](#security)
- [Multi-Instance Support](#multi-instance-support)
- [Troubleshooting](#troubleshooting)
- [Advanced Usage](#advanced-usage)

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

# Or run directly with npx (no installation required)
npx mysql-mcp-webui
```

### Setup Guide for Claude Desktop

**Important:** You must generate an API token *before* configuring Claude Desktop. Follow these steps in order:

#### Step 1: Generate Your API Token

Before setting up Claude Desktop, generate an authentication token:

```bash
mysql-mcp-webui --generate-token
```

This will output something like:
```
✓ API Token generated successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  mcp_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  IMPORTANT: Save this token securely!
   This token will NOT be shown again.
```

**Copy this token** - you'll need it in the next step.

#### Step 2: Configure Claude Desktop

Add this configuration to your Claude Desktop config file:

**Config file location:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration:**
```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "mysql-mcp-webui"],
      "env": {
        "TRANSPORT": "stdio",
        "AUTH_TOKEN": "paste-your-token-here"
      }
    }
  }
}
```

**Replace** `paste-your-token-here` with the token from Step 1.

> **Note:** If you installed globally with `npm install -g`, you can also use `"command": "mysql-mcp-webui"` without the `args` field.

#### Step 3: Start Claude Desktop

1. **Save** the config file
2. **Restart Claude Desktop** completely (quit and reopen)
3. Claude Desktop will automatically start the MCP server
4. The **Web UI** will be available at **http://localhost:9274**

#### Step 4: Configure MySQL Connections

Open the Web UI at **http://localhost:9274**:

1. **Login** with default credentials: `admin` / `admin`
   - You'll be prompted to change the password on first login
2. **Add a MySQL connection**:
   - Enter your MySQL server host, port, username, and password
   - Click "Test Connection" to verify it works
3. **Discover databases**:
   - Click "Discover Databases" to auto-detect all available databases
4. **Set permissions**:
   - For each database, enable the operations Claude can perform
   - Start with **SELECT only** for production databases
5. **Set a default connection** (optional):
   - Makes it easier to start new Claude Desktop instances

#### Step 5: Start Using Claude

You're all set! Now you can ask Claude to query your databases:

```
You: "Show me the top 10 users by registration date"
Claude: [Uses mysql_query tool to fetch the data]
```

### Troubleshooting Setup

**"AUTH_TOKEN is required" error:**
- Make sure you ran `mysql-mcp-webui --generate-token` first
- Verify the token is correctly pasted in the config file (no extra spaces or quotes)
- Check that the config file is valid JSON

**Claude Desktop doesn't see the MCP server:**
- Verify the config file location is correct for your OS
- Restart Claude Desktop completely (quit and reopen, don't just reload)
- Check for syntax errors in the JSON (use a JSON validator)

**Web UI not accessible:**
- The server only starts when Claude Desktop launches it
- Check if port 9274 is already in use: `lsof -i :9274` (macOS/Linux)
- Try a different port by adding `"HTTP_PORT": "3001"` to the `env` section

## Setup Guide for Claude Code (HTTP Mode)

Claude Code can connect to MySQL MCP Server via HTTP mode, allowing remote access and multiple concurrent sessions.

### Option 1: Using npx (No Docker)

#### Step 1: Start the Server

```bash
# Start in HTTP mode on default port 9274
TRANSPORT=http npx -y mysql-mcp-webui

# Or on a custom port
TRANSPORT=http HTTP_PORT=3001 npx -y mysql-mcp-webui
```

#### Step 2: Generate API Token

Open the Web UI at `http://localhost:9274` (or your custom port):
1. Login with default credentials: `admin` / `admin`
2. Navigate to **API Keys** section
3. Click **Generate New API Key**
4. Copy the generated key

#### Step 3: Configure Claude Code

Add this to your Claude Code MCP settings (`.claude/mcp_settings.json` or via UI):

```json
{
  "mcpServers": {
    "mysql": {
      "type": "http",
      "url": "http://localhost:9274/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key-here"
      }
    }
  }
}
```

**For remote/production deployment**, use your domain:

```json
{
  "mcpServers": {
    "mysql": {
      "type": "http",
      "url": "https://yourdomain.com/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key-here"
      }
    }
  }
}
```

### Option 2: Using Docker (Recommended for Production)

#### Step 1: Deploy with Docker

**Quick Start (No cloning needed):**
```bash
# Run directly from npm-based Docker image
docker run -d \
  --name mysql-mcp \
  -p 9274:9274 \
  -v mysql-mcp-data:/app/data \
  -e TRANSPORT=http \
  -e NODE_ENV=production \
  mysql-mcp-webui

# Or build and run locally
docker build -t mysql-mcp-webui https://github.com/yashagldit/mysql-mcp-webui.git
docker run -d \
  --name mysql-mcp \
  -p 9274:9274 \
  -v mysql-mcp-data:/app/data \
  -e TRANSPORT=http \
  -e NODE_ENV=production \
  mysql-mcp-webui
```

**Using docker-compose (for advanced configuration):**
```bash
# Clone only if you need custom docker-compose.yml
git clone https://github.com/yashagldit/mysql-mcp-webui.git
cd mysql-mcp-webui
cp .env.example .env
# Edit .env if needed (change ports, enable HTTPS, etc.)
docker-compose up -d
```

#### Step 2: Get API Key

```bash
# Access Web UI at http://localhost:9274
# Login: admin / admin
# Navigate to API Keys → Generate New API Key
```

#### Step 3: Configure Claude Code

```json
{
  "mcpServers": {
    "mysql": {
      "type": "http",
      "url": "http://localhost:9274/mcp",
      "headers": {
        "Authorization": "Bearer your-docker-api-key-here"
      }
    }
  }
}
```

### Step 4: Configure MySQL Connections

Same as Claude Desktop setup - use the Web UI to:
1. Add MySQL connections
2. Discover databases
3. Set permissions
4. Optionally set a default connection

### Docker Deployment Options

**Basic HTTP Mode:**
```bash
docker run -d \
  --name mysql-mcp \
  -p 9274:9274 \
  -v mysql-mcp-data:/app/data \
  mysql-mcp-webui
```

**Custom Port:**
```bash
docker run -d \
  --name mysql-mcp \
  -p 3001:3001 \
  -v mysql-mcp-data:/app/data \
  -e HTTP_PORT=3001 \
  mysql-mcp-webui
```

**With HTTPS (Production):**
```bash
docker run -d \
  --name mysql-mcp \
  -p 443:9274 \
  -v mysql-mcp-data:/app/data \
  -v /etc/letsencrypt:/app/certs:ro \
  -e ENABLE_HTTPS=true \
  -e SSL_CERT_PATH=/app/certs/live/yourdomain.com/fullchain.pem \
  -e SSL_KEY_PATH=/app/certs/live/yourdomain.com/privkey.pem \
  mysql-mcp-webui
```

**Using docker-compose.yml:**

The repository includes a ready-to-use `docker-compose.yml`:

```yaml
services:
  mysql-mcp:
    image: mysql-mcp-webui
    ports:
      - "9274:9274"
    volumes:
      - mysql-mcp-data:/app/data
    environment:
      - TRANSPORT=http
      - NODE_ENV=production
    restart: unless-stopped

volumes:
  mysql-mcp-data:
```

For detailed production deployment with HTTPS, rate limiting, and security hardening, see [DEPLOYMENT.md](DEPLOYMENT.md).

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
│  You: "Show me users who signed up this month"      │
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
│  MySQL MCP Server                                   │
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
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "mysql-mcp-webui"],
      "env": {
        "TRANSPORT": "stdio",
        "AUTH_TOKEN": "your-api-key",
        "HTTP_PORT": "9274"
      }
    }
  }
}
```
- MCP communication via stdin/stdout (managed by Claude Desktop)
- Web UI runs on separate HTTP port (default: 9274, customizable)
- Each Claude Desktop instance spawns its own process
- Perfect for local development and desktop use

**Custom port in stdio mode:**
```json
{
  "env": {
    "TRANSPORT": "stdio",
    "AUTH_TOKEN": "your-api-key",
    "HTTP_PORT": "3001"
  }
}
```

**HTTP Mode** (For Claude Code and remote access):
```bash
# Start server in HTTP mode (default port 9274)
TRANSPORT=http mysql-mcp-webui

# Custom port
TRANSPORT=http HTTP_PORT=3001 mysql-mcp-webui

# MCP endpoint available at:
# http://localhost:9274/mcp (or your custom port)
```
- MCP communication via HTTP endpoint at `/mcp`
- Supports multiple concurrent sessions with isolation
- Includes REST API and Web UI on same port
- Perfect for remote access, Docker deployment, and Claude Code

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSPORT` | `http` | Transport mode: `stdio` or `http` |
| `HTTP_PORT` | `9274` | Port for Web UI, API, and MCP endpoint (customizable in both modes) |
| `AUTH_TOKEN` | - | API key (required for stdio mode) |
| `NODE_ENV` | `development` | Environment: `development` or `production` |
| `ENABLE_HTTPS` | `false` | Enable HTTPS/TLS |
| `SSL_CERT_PATH` | - | Path to SSL certificate (required if HTTPS enabled) |
| `SSL_KEY_PATH` | - | Path to SSL private key (required if HTTPS enabled) |
| `JWT_SECRET` | (auto-generated) | Secret for JWT tokens (optional in development, recommended for production) |
| `JWT_EXPIRES_IN` | `7d` | JWT token expiration (e.g., 1h, 24h, 7d, 30d) |
| `RATE_LIMIT_ENABLED` | `true` | Enable rate limiting |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in milliseconds (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Maximum requests per window |

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

### MCP server fails to start with AUTH_TOKEN error

**Symptom:** Claude Desktop logs show "AUTH_TOKEN environment variable is required" or "Invalid AUTH_TOKEN provided"

**Solution:**
1. **Generate a new token** (if you haven't already):
   ```bash
   mysql-mcp-webui --generate-token
   ```
2. **Copy the generated token** from the output
3. **Update your Claude Desktop config** file with the new token:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
4. **Verify the JSON syntax** is correct (no extra spaces, quotes, or commas)
5. **Restart Claude Desktop** completely (quit and reopen)

**Note:** You must generate the token *before* starting Claude Desktop, not after.

### Claude can't connect to MCP server

1. Check Claude Desktop config file syntax (valid JSON)
2. Generate a new API key if needed: `mysql-mcp-webui --generate-token`
3. Verify the token is correctly pasted in the config file
4. Restart Claude Desktop completely (quit and reopen, not just reload)
5. Check Web UI is accessible at http://localhost:9274

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
