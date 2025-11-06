# MySQL MCP WebUI - Production Dockerfile (NPM Package)
# Deploys using the published npm package mysql-mcp-webui

FROM node:20-alpine

WORKDIR /app

# Build argument for port (can be overridden at build time)
ARG HTTP_PORT=5197

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install mysql-mcp-webui from npm (specify version to avoid cache)
RUN npm install -g mysql-mcp-webui@0.0.6

# Create data directory for SQLite database at /app/data (volume mount point)
RUN mkdir -p /app/data && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (uses build arg)
EXPOSE ${HTTP_PORT}

# Health check (uses environment variable at runtime)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const port = process.env.HTTP_PORT || 5197; require('http').get('http://localhost:' + port + '/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Set environment variables
ENV NODE_ENV=production \
    TRANSPORT=http

# Start the server using the global binary
CMD ["mysql-mcp-webui"]
