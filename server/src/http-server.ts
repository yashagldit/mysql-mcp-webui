import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware, optionalAuthMiddleware } from './api/middleware/auth.js';
import { loggingMiddleware } from './api/middleware/logging.js';
import connectionsRouter from './api/routes/connections.js';
import databasesRouter from './api/routes/databases.js';
import queryRouter from './api/routes/query.js';
import settingsRouter from './api/routes/settings.js';
import apiKeysRouter from './api/routes/api-keys.js';
import logsRouter from './api/routes/logs.js';
import { getMcpServer } from './mcp/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createHttpServer(): Express {
  const app = express();

  // Middleware
  app.use(express.json());
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

  // MCP endpoint (requires auth)
  const mcpServer = getMcpServer();
  app.post('/mcp', authMiddleware, mcpServer.getHttpHandler());

  // API routes (all require auth except health)
  app.use('/api/connections', authMiddleware, connectionsRouter);
  app.use('/api/connections', authMiddleware, databasesRouter);
  app.use('/api/query', authMiddleware, queryRouter);
  app.use('/api/settings', authMiddleware, settingsRouter);
  app.use('/api/active', authMiddleware, settingsRouter);
  app.use('/api/keys', authMiddleware, apiKeysRouter);
  app.use('/api/logs', authMiddleware, logsRouter);

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    const publicPath = path.resolve(__dirname, '../public');
    app.use(express.static(publicPath));

    // Fallback to index.html for client-side routing
    app.get('*', (req: Request, res: Response) => {
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
