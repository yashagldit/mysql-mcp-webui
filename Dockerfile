# MySQL MCP WebUI - Production Dockerfile
# Multi-stage build for optimized image size

# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for both workspaces
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source files
COPY client ./client
COPY server ./server
COPY tsconfig.json ./

# Build client and server
RUN npm run build

# Stage 2: Production stage
FROM node:20-alpine

WORKDIR /app

# Build argument for port (can be overridden at build time)
ARG HTTP_PORT=3000

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built artifacts from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/server/dist ./server/dist
COPY --from=builder --chown=nodejs:nodejs /app/server/public ./server/public

# Create data directory for SQLite database
RUN mkdir -p /app/data && \
    chown -R nodejs:nodejs /app/data

# Switch to non-root user
USER nodejs

# Expose port (uses build arg)
EXPOSE ${HTTP_PORT}

# Health check (uses environment variable at runtime)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const port = process.env.HTTP_PORT || 3000; require('http').get('http://localhost:' + port + '/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Set environment variables
ENV NODE_ENV=production \
    TRANSPORT=http \
    HTTP_PORT=${HTTP_PORT}

# Start the server
CMD ["node", "server/dist/index.js"]
