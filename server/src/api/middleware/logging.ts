import type { Request, Response, NextFunction } from 'express';
import { getDatabaseManager } from '../../db/database-manager.js';

/**
 * Check if a request should be logged
 * Only logs MCP-related operations (MCP endpoint is logged separately in handlers)
 */
function shouldLogRequest(req: Request): boolean {
  const path = req.path;

  // Don't log MCP endpoint here - it's logged in MCP handlers
  if (path === '/mcp') {
    return false;
  }

  // Don't log UI routes, static assets, polling endpoints, and health checks
  const excludedPaths = [
    '/',
    '/active',
    '/stats',
    '/api/health',
    '/api/active',
    '/api/stats',
    '/api/logs',
    '/api/keys',
    '/api/connections',
  ];

  if (excludedPaths.includes(path)) {
    return false;
  }

  // Don't log static assets
  if (path.startsWith('/assets/')) {
    return false;
  }

  // Only log if it's an API query execution endpoint
  // (e.g., /api/query or other actual database operations)
  if (path === '/api/query' && req.method === 'POST') {
    return true;
  }

  // Don't log anything else
  return false;
}

/**
 * Request logging middleware
 * Logs MySQL query-related API requests with their responses to the database
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only log MySQL query-related requests
  if (!shouldLogRequest(req)) {
    next();
    return;
  }

  // Record start time
  req.startTime = Date.now();

  // Capture the original json method
  const originalJson = res.json.bind(res);

  // Override res.json to capture response
  res.json = function (body: any): Response {
    // Calculate duration
    const duration = req.startTime ? Date.now() - req.startTime : 0;

    // Log to database if API key or user is available
    if (req.apiKeyId || req.user) {
      try {
        const dbManager = getDatabaseManager();
        dbManager.logRequest(
          req.apiKeyId || null,
          req.path,
          req.method,
          req.body,
          body,
          res.statusCode,
          duration,
          req.user?.userId
        );
      } catch (error) {
        console.error('Failed to log request:', error);
      }
    }

    // Call original json method
    return originalJson(body);
  };

  next();
}
