import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware, optionalAuthMiddleware, smartAuthMiddleware } from './api/middleware/auth.js';
import { loggingMiddleware } from './api/middleware/logging.js';
import { createApiRateLimiter, createQueryRateLimiter, createMcpRateLimiter } from './api/middleware/rate-limit.js';
import connectionsRouter from './api/routes/connections.js';
import databasesRouter from './api/routes/databases.js';
import queryRouter from './api/routes/query.js';
import settingsRouter from './api/routes/settings.js';
import apiKeysRouter from './api/routes/api-keys.js';
import logsRouter from './api/routes/logs.js';
import authRouter from './api/routes/auth.js';
import usersRouter from './api/routes/users.js';
import browseRouter from './api/routes/browse.js';
import { getMcpServer } from './mcp/server.js';
import type { EnvironmentConfig } from './config/environment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createHttpServer(config: EnvironmentConfig): Express {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    cors({
      origin: process.env.NODE_ENV === 'production' ? false : true,
      credentials: true,
    })
  );

  // Console logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });

  // Database logging (logs requests with API key)
  app.use(loggingMiddleware);

  // Rate limiting (if enabled)
  if (config.rateLimitEnabled) {
    const apiRateLimiter = createApiRateLimiter(config.rateLimitWindowMs, config.rateLimitMaxRequests);
    const queryRateLimiter = createQueryRateLimiter(60 * 1000, 30); // 30 queries per minute
    const mcpRateLimiter = createMcpRateLimiter(config.rateLimitWindowMs, config.rateLimitMaxRequests);

    // Apply rate limiters to appropriate routes
    app.use('/api', apiRateLimiter);
    app.use('/api/query', queryRateLimiter);
    app.use('/mcp', mcpRateLimiter);

    console.log(`Rate limiting enabled: ${config.rateLimitMaxRequests} requests per ${config.rateLimitWindowMs / 1000}s`);
  }

  // Health check endpoint (public, no auth)
  app.get('/api/health', async (req, res, next) => {
    try {
      const settingsRouter = (await import('./api/routes/settings.js')).default;
      const handler = settingsRouter.stack.find(
        (layer) => layer.route?.path === '/health'
      );
      if (handler && handler.route) {
        handler.route.stack[0].handle(req, res, next);
      } else {
        next();
      }
    } catch (error) {
      next(error);
    }
  });

  // MCP endpoint - configured using StreamableHTTPServerTransport
  // Authentication is handled inside setupHttpTransport
  const mcpServer = getMcpServer();
  mcpServer.setupHttpTransport(app);

  // Auth routes (public endpoints for login/logout, but some require auth)
  // Login and check-token are public, others require authentication
  app.use('/api/auth', authRouter);

  // API routes (all require authentication - no localhost bypass)
  app.use('/api/connections', smartAuthMiddleware, connectionsRouter);
  app.use('/api/connections', smartAuthMiddleware, databasesRouter);
  app.use('/api/query', smartAuthMiddleware, queryRouter);
  app.use('/api/browse', smartAuthMiddleware, browseRouter);
  app.use('/api', smartAuthMiddleware, settingsRouter);
  app.use('/api/keys', smartAuthMiddleware, apiKeysRouter);
  app.use('/api/logs', smartAuthMiddleware, logsRouter);
  app.use('/api/users', smartAuthMiddleware, usersRouter);

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    const publicPath = path.resolve(__dirname, '../public');
    app.use(express.static(publicPath));

    // Fallback to index.html for client-side routing (Express 5 syntax with named wildcard)
    app.get('/*splat', (req: Request, res: Response) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  } else {
    // Development mode - API only
    app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'MySQL MCP WebUI Server',
        version: '1.0.0',
        mode: 'development',
        message: 'API server running. Web UI is served separately by Vite dev server.',
        endpoints: {
          health: '/api/health',
          mcp: '/mcp',
          api: '/api/*',
        },
      });
    });
  }

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  return app;
}
