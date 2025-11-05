# Server Installation Guide

This guide covers installing mysql-mcp-webui on your production server.

---

## Method 1: Docker Installation (RECOMMENDED) 🐳

### Step 1: Install Docker

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install -y docker.io docker-compose git
sudo systemctl start docker
sudo systemctl enable docker

# Optional: Run Docker without sudo
sudo usermod -aG docker $USER
# Log out and back in
```

#### CentOS/RHEL:
```bash
sudo yum install -y docker docker-compose git
sudo systemctl start docker
sudo systemctl enable docker
```

#### Amazon Linux 2:
```bash
sudo yum update -y
sudo yum install -y docker git
sudo service docker start
sudo usermod -a -G docker ec2-user
# Install docker-compose separately
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Step 2: Clone the Repository

```bash
# SSH into your server first
ssh user@your-server-ip

# Clone the repository
cd /opt  # or wherever you want to install
sudo git clone https://github.com/yashagldit/mysql-mcp-webui.git
cd mysql-mcp-webui

# Set proper permissions
sudo chown -R $USER:$USER .
```

### Step 3: Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit configuration
nano .env  # or vim .env
```

**Minimal configuration:**
```env
# Transport mode
TRANSPORT=http

# Port
HTTP_PORT=3000

# Environment
NODE_ENV=production

# Rate limiting (recommended for production)
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
```

**With HTTPS (recommended for production):**
```env
TRANSPORT=http
HTTP_PORT=3000
NODE_ENV=production

# Enable HTTPS
ENABLE_HTTPS=true
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem

# Rate limiting
RATE_LIMIT_ENABLED=true
```

### Step 4: Start the Service

```bash
# Build and start
docker-compose up -d

# Check if it's running
docker-compose ps

# View logs
docker-compose logs -f

# Check for the API key in logs
docker-compose logs | grep "API key"
```

### Step 5: Access the Web UI

```bash
# Open in browser
http://your-server-ip:3000

# Or if using HTTPS
https://yourdomain.com:3000
```

### Step 6: Configure Firewall

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 3000/tcp
sudo ufw reload

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload

# Or restrict to specific IPs
sudo ufw allow from 192.168.1.0/24 to any port 3000
```

### Managing the Service

```bash
# Stop the service
docker-compose down

# Restart the service
docker-compose restart

# Update to latest version
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# View logs
docker-compose logs -f mysql-mcp

# Check container health
docker ps
```

---

## Method 2: Native Installation (Alternative) 📦

### Prerequisites

```bash
# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v20.x or higher
npm --version
```

### Installation Steps

#### Step 1: Clone Repository
```bash
cd /opt
sudo git clone https://github.com/yashagldit/mysql-mcp-webui.git
cd mysql-mcp-webui
sudo chown -R $USER:$USER .
```

#### Step 2: Install Dependencies
```bash
npm install
```

#### Step 3: Build the Project
```bash
npm run build
```

#### Step 4: Configure Environment
```bash
cp .env.example .env
nano .env
```

Set at minimum:
```env
TRANSPORT=http
HTTP_PORT=3000
NODE_ENV=production
```

#### Step 5: Start the Server
```bash
# Start directly
npm run start:http

# Or with custom port
HTTP_PORT=8080 npm run start:http
```

#### Step 6: Set Up as System Service

Create systemd service file:
```bash
sudo nano /etc/systemd/system/mysql-mcp-webui.service
```

Add this content:
```ini
[Unit]
Description=MySQL MCP WebUI
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/mysql-mcp-webui
ExecStart=/usr/bin/node /opt/mysql-mcp-webui/server/dist/index.js
Restart=on-failure
RestartSec=10

# Environment variables
Environment="NODE_ENV=production"
Environment="TRANSPORT=http"
Environment="HTTP_PORT=3000"

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mysql-mcp-webui

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable mysql-mcp-webui

# Start the service
sudo systemctl start mysql-mcp-webui

# Check status
sudo systemctl status mysql-mcp-webui

# View logs
sudo journalctl -u mysql-mcp-webui -f
```

---

## Method 3: Using Nginx Reverse Proxy (Production Best Practice) 🔒

### Why Use Nginx?
- ✅ SSL/TLS termination
- ✅ Better performance
- ✅ Load balancing
- ✅ Additional security headers

### Install Nginx
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Configure Nginx

Create config file:
```bash
sudo nano /etc/nginx/sites-available/mysql-mcp-webui
```

Add configuration:
```nginx
server {
    listen 80;
    server_name mcp.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mcp.yourdomain.com;

    # SSL certificates (will be added by certbot)
    ssl_certificate /etc/letsencrypt/live/mcp.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy settings
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/mysql-mcp-webui /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Obtain SSL certificate
sudo certbot --nginx -d mcp.yourdomain.com

# Restart Nginx
sudo systemctl restart nginx
```

Now access via: `https://mcp.yourdomain.com`

---

## Quick Start Commands Summary

### Docker (Recommended):
```bash
# 1. Install Docker
sudo apt install -y docker.io docker-compose git

# 2. Clone and configure
cd /opt
sudo git clone https://github.com/yashagldit/mysql-mcp-webui.git
cd mysql-mcp-webui
cp .env.example .env
nano .env

# 3. Start
docker-compose up -d

# 4. Get API key
docker-compose logs | grep "API key"

# 5. Open in browser
http://your-server-ip:3000
```

### Native Installation:
```bash
# 1. Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# 2. Clone and build
cd /opt
sudo git clone https://github.com/yashagldit/mysql-mcp-webui.git
cd mysql-mcp-webui
npm install
npm run build

# 3. Configure
cp .env.example .env
nano .env

# 4. Start
npm run start:http
```

---

## Post-Installation Tasks

### 1. Get Your API Key
```bash
# Docker:
docker-compose logs | grep "API key"

# Native:
# Check console output when server starts
```

### 2. Access Web UI
Navigate to `http://your-server-ip:3000` and enter the API key.

### 3. Add MySQL Connection
1. Click "Add Connection" in the Web UI
2. Enter MySQL server details:
   - Host: your-mysql-host
   - Port: 3306
   - Username: your-username
   - Password: your-password
3. Test connection
4. Discover databases
5. Set permissions for each database

### 4. Configure Claude Desktop/Code
Add to your Claude config (`~/.claude.json`):

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "type": "http",
      "url": "http://your-server-ip:3000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY_HERE"
      }
    }
  }
}
```

### 5. Security Best Practices

1. **Change default port** (optional):
   ```env
   HTTP_PORT=8443
   ```

2. **Enable rate limiting**:
   ```env
   RATE_LIMIT_ENABLED=true
   RATE_LIMIT_MAX_REQUESTS=100
   ```

3. **Set up HTTPS** with Let's Encrypt:
   ```bash
   sudo certbot certonly --standalone -d mcp.yourdomain.com
   ```

4. **Configure firewall**:
   ```bash
   sudo ufw allow 3000/tcp
   # Or restrict to specific IPs
   sudo ufw allow from YOUR_IP to any port 3000
   ```

5. **Regular backups**:
   ```bash
   # Backup SQLite database
   cp data/mysql-mcp.db data/mysql-mcp.db.backup-$(date +%Y%m%d)
   ```

---

## Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
sudo lsof -i :3000

# Kill the process
sudo kill -9 PID

# Or change the port in .env
HTTP_PORT=8080
```

### Docker Container Won't Start
```bash
# Check logs
docker-compose logs mysql-mcp

# Rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Permission Issues
```bash
# Fix data directory permissions
sudo chown -R $USER:$USER ./data

# Or for Docker
sudo chown -R 1001:1001 ./data
```

### Can't Access from Outside
```bash
# Check firewall
sudo ufw status

# Allow port
sudo ufw allow 3000/tcp

# Check if service is listening
sudo netstat -tulpn | grep 3000
```

### SSL Certificate Issues
```bash
# Verify certificate exists
ls -la /etc/letsencrypt/live/yourdomain.com/

# Check certificate expiry
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/fullchain.pem -noout -dates

# Renew certificate
sudo certbot renew
```

---

## Updating to Latest Version

### Docker:
```bash
cd /opt/mysql-mcp-webui
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Native:
```bash
cd /opt/mysql-mcp-webui
git pull
npm install
npm run build
sudo systemctl restart mysql-mcp-webui
```

---

## Monitoring

### Check Service Health
```bash
# Health check endpoint
curl http://localhost:3000/api/health

# Expected response:
# {"status":"healthy","transport":"http"}
```

### View Logs
```bash
# Docker:
docker-compose logs -f mysql-mcp

# Native (systemd):
sudo journalctl -u mysql-mcp-webui -f

# Last 100 lines:
docker-compose logs --tail=100 mysql-mcp
```

### Monitor Resource Usage
```bash
# Docker:
docker stats mysql-mcp-webui

# System-wide:
htop
```

---

## Support

For issues and questions:
- **Documentation**: [README.md](README.md) and [DEPLOYMENT.md](DEPLOYMENT.md)
- **GitHub Issues**: https://github.com/yashagldit/mysql-mcp-webui/issues
- **Logs**: Always include relevant log output when reporting issues

---

## Quick Reference

| Task | Docker Command | Native Command |
|------|----------------|----------------|
| Start | `docker-compose up -d` | `sudo systemctl start mysql-mcp-webui` |
| Stop | `docker-compose down` | `sudo systemctl stop mysql-mcp-webui` |
| Restart | `docker-compose restart` | `sudo systemctl restart mysql-mcp-webui` |
| Logs | `docker-compose logs -f` | `sudo journalctl -u mysql-mcp-webui -f` |
| Status | `docker-compose ps` | `sudo systemctl status mysql-mcp-webui` |
| Update | `git pull && docker-compose up -d --build` | `git pull && npm run build && sudo systemctl restart mysql-mcp-webui` |

