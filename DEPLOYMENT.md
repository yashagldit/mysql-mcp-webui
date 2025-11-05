# MySQL MCP WebUI - Deployment Guide

This guide covers deploying MySQL MCP WebUI for production use with Docker, including multi-instance support, HTTPS configuration, and security best practices.

## Table of Contents

- [Quick Start](#quick-start)
- [Docker Deployment](#docker-deployment)
- [Environment Configuration](#environment-configuration)
- [HTTPS/TLS Setup](#httpstls-setup)
- [Multi-Instance Support](#multi-instance-support)
- [Security Best Practices](#security-best-practices)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone and configure:**
   ```bash
   git clone <repository-url>
   cd MySQLMCP
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start the service:**
   ```bash
   docker-compose up -d
   ```

3. **Access the Web UI:**
   - Open http://localhost:3000
   - Get your API key from the container logs:
     ```bash
     docker-compose logs mysql-mcp | grep "API key"
     ```

---

## Docker Deployment

### Building the Image

```bash
# Build the Docker image
docker build -t mysql-mcp-webui .

# Or use docker-compose
docker-compose build
```

### Running with Docker

**Basic HTTP mode:**
```bash
docker run -d \
  --name mysql-mcp \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e TRANSPORT=http \
  -e NODE_ENV=production \
  mysql-mcp-webui
```

**With HTTPS:**
```bash
docker run -d \
  --name mysql-mcp \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/certs:/app/certs:ro \
  -e TRANSPORT=http \
  -e ENABLE_HTTPS=true \
  -e SSL_CERT_PATH=/app/certs/fullchain.pem \
  -e SSL_KEY_PATH=/app/certs/privkey.pem \
  -e NODE_ENV=production \
  mysql-mcp-webui
```

### Using Docker Compose

1. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```

2. **Configure environment variables** (see [Environment Configuration](#environment-configuration))

3. **Start services:**
   ```bash
   # Start in detached mode
   docker-compose up -d

   # View logs
   docker-compose logs -f

   # Stop services
   docker-compose down
   ```

4. **Update and restart:**
   ```bash
   git pull
   docker-compose down
   docker-compose build
   docker-compose up -d
   ```

---

## Environment Configuration

### Required Variables

```env
# Transport mode: 'http' or 'stdio'
TRANSPORT=http

# HTTP port
HTTP_PORT=3000

# Environment
NODE_ENV=production
```

### Optional Variables

```env
# HTTPS Configuration
ENABLE_HTTPS=true
SSL_CERT_PATH=/path/to/fullchain.pem
SSL_KEY_PATH=/path/to/privkey.pem

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100       # requests per window

# stdio Mode Only
AUTH_TOKEN=your-secure-token-here
```

### Environment Variable Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSPORT` | `http` | Transport mode (`http` or `stdio`) |
| `HTTP_PORT` | `3000` | HTTP server port |
| `ENABLE_HTTPS` | `false` | Enable HTTPS |
| `SSL_CERT_PATH` | - | Path to SSL certificate |
| `SSL_KEY_PATH` | - | Path to SSL private key |
| `RATE_LIMIT_ENABLED` | `true` | Enable rate limiting |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |
| `NODE_ENV` | `development` | Node environment |
| `AUTH_TOKEN` | - | Auth token (stdio mode only) |

---

## HTTPS/TLS Setup

### Using Let's Encrypt (Recommended for Production)

1. **Install Certbot:**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install certbot

   # macOS
   brew install certbot
   ```

2. **Obtain certificates:**
   ```bash
   sudo certbot certonly --standalone -d yourdomain.com
   ```

3. **Configure environment:**
   ```env
   ENABLE_HTTPS=true
   SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
   SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
   ```

4. **Mount certificates in Docker:**
   ```yaml
   volumes:
     - /etc/letsencrypt:/etc/letsencrypt:ro
   ```

5. **Auto-renewal:**
   ```bash
   # Add to crontab
   0 0 * * * certbot renew --quiet && docker-compose restart mysql-mcp
   ```

### Self-Signed Certificates (Development)

1. **Generate certificate:**
   ```bash
   mkdir -p certs
   openssl req -x509 -newkey rsa:4096 \
     -keyout certs/key.pem \
     -out certs/cert.pem \
     -days 365 -nodes \
     -subj "/CN=localhost"
   ```

2. **Configure:**
   ```env
   ENABLE_HTTPS=true
   SSL_CERT_PATH=./certs/cert.pem
   SSL_KEY_PATH=./certs/key.pem
   ```

---

## Multi-Instance Support

MySQL MCP WebUI supports running multiple instances simultaneously with proper isolation.

### Architecture

**stdio Mode (Multiple Processes):**
- Each Claude Desktop instance spawns a separate MCP server process
- Each process maintains independent active connection state
- Shared SQLite database with safe concurrent writes
- Use case: Multiple Claude Desktop users on the same machine

**HTTP Mode (Multiple Sessions):**
- Single Docker container serves multiple Claude Code sessions
- Each HTTP session maintains isolated state
- Session-based connection/database tracking
- Use case: Remote access from multiple developers

### stdio Mode Deployment

**Process 1:**
```bash
TRANSPORT=stdio \
AUTH_TOKEN=token1 \
HTTP_PORT=3001 \
node server/dist/index.js
```

**Process 2:**
```bash
TRANSPORT=stdio \
AUTH_TOKEN=token2 \
HTTP_PORT=3002 \
node server/dist/index.js
```

Each process will:
- Use the same SQLite database safely
- Maintain its own active connection in memory
- Not interfere with other processes

### HTTP Mode Deployment

Single instance serves multiple sessions:

```bash
docker-compose up -d
```

Multiple Claude Code instances can connect:
- Each gets its own session ID
- Sessions are isolated from each other
- Stale sessions auto-cleanup after 30 minutes

### Default Connection Management

The Web UI can set a "default connection" that applies to new instances:

1. **Set default via Web UI:**
   - Navigate to Connections
   - Click "Set as Default" on desired connection

2. **Set default via API:**
   ```bash
   curl -X POST http://localhost:3000/api/connections/:id/set-default \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

3. **Behavior:**
   - New MCP instances start with the default connection
   - Running instances are NOT affected
   - Each instance can switch connections independently

---

## Security Best Practices

### 1. API Key Management

**Generate secure API keys:**
```bash
# Generate a random 64-character key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Rotate keys regularly:**
- Create new API key in Web UI
- Update clients to use new key
- Revoke old key

### 2. Database Permissions

Configure per-database permissions in the Web UI:
- **SELECT**: Read-only queries
- **INSERT/UPDATE/DELETE**: Data modifications
- **CREATE/ALTER/DROP**: Schema changes
- **TRUNCATE**: Table clearing

**Principle of least privilege:**
- Grant only necessary permissions
- Use separate connections for different environments
- Review permissions regularly

### 3. Network Security

**Firewall rules:**
```bash
# Allow only from specific IPs
ufw allow from 192.168.1.0/24 to any port 3000
```

**Reverse proxy (recommended):**
```nginx
server {
    listen 443 ssl http2;
    server_name mcp.yourdomain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Rate Limiting

Enable and configure rate limiting:
```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100     # per API key
```

Separate limits for queries (30/minute) are automatically applied.

### 5. MySQL Connection Security

**Use SSL for MySQL connections:**
- Configure SSL in MySQL server
- Use `requireSSL` option in connection config

**Restrict MySQL user permissions:**
```sql
-- Create dedicated user
CREATE USER 'mcp'@'%' IDENTIFIED BY 'secure-password';

-- Grant only necessary permissions
GRANT SELECT ON mydb.* TO 'mcp'@'%';
GRANT INSERT, UPDATE ON mydb.logs TO 'mcp'@'%';

FLUSH PRIVILEGES;
```

---

## Monitoring & Maintenance

### Health Checks

**Endpoint:**
```bash
curl http://localhost:3000/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "transport": "http",
  "activeConnection": "conn_abc123"
}
```

**Docker health check:**
```bash
docker ps  # Check STATUS column
```

### Logs

**View Docker logs:**
```bash
# Follow logs
docker-compose logs -f mysql-mcp

# Last 100 lines
docker-compose logs --tail=100 mysql-mcp

# Grep for errors
docker-compose logs mysql-mcp | grep ERROR
```

**Log locations (non-Docker):**
- Server logs: stdout/stderr
- SQLite logs: Written to request_logs table
- Query logs: Access via Web UI or API

### Database Maintenance

**Backup SQLite database:**
```bash
# Stop container first
docker-compose down

# Backup
cp data/mysql-mcp.db data/mysql-mcp.db.backup-$(date +%Y%m%d)

# Restart
docker-compose up -d
```

**Clear old logs:**
```bash
curl -X POST http://localhost:3000/api/logs/clear?days=30 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Updates

**Update to latest version:**
```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Verify
docker-compose logs -f
```

---

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to MCP server

**Solutions:**
1. Check if container is running:
   ```bash
   docker ps
   ```

2. Check logs for errors:
   ```bash
   docker-compose logs mysql-mcp
   ```

3. Verify port is accessible:
   ```bash
   curl http://localhost:3000/api/health
   ```

4. Check firewall rules

### SQLite Locking Errors

**Problem:** `SQLITE_BUSY` or "database is locked" errors

**This should not happen with the multi-instance support!** If you see this:

1. Check retry logic is working:
   ```bash
   grep "retry" docker-compose logs
   ```

2. Verify WAL mode is enabled:
   ```bash
   sqlite3 data/mysql-mcp.db "PRAGMA journal_mode"
   # Should return: wal
   ```

3. Check file permissions:
   ```bash
   ls -la data/
   ```

### HTTPS Not Working

**Problem:** Certificate errors or HTTPS not enabled

**Solutions:**
1. Verify certificate files exist:
   ```bash
   ls -la certs/
   ```

2. Check certificate validity:
   ```bash
   openssl x509 -in certs/cert.pem -text -noout
   ```

3. Verify environment variables:
   ```bash
   docker-compose config
   ```

4. Check logs for TLS errors:
   ```bash
   docker-compose logs | grep -i tls
   ```

### Rate Limiting Issues

**Problem:** Getting 429 Too Many Requests

**Solutions:**
1. Increase rate limits in `.env`:
   ```env
   RATE_LIMIT_MAX_REQUESTS=200
   ```

2. Disable rate limiting (development only):
   ```env
   RATE_LIMIT_ENABLED=false
   ```

3. Check which endpoint is being rate limited:
   ```bash
   # Response includes Retry-After header
   curl -i http://localhost:3000/api/query
   ```

---

## Support

For issues and questions:
- **GitHub Issues**: https://github.com/your-repo/issues
- **Documentation**: See README.md and CLAUDE.md
- **Logs**: Always include relevant log output when reporting issues

---

## License

[Your License Here]
