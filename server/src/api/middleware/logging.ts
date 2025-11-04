import type { Request, Response, NextFunction } from 'express';
import { getDatabaseManager } from '../../db/database-manager.js';

// Extend Request to include apiKeyId
declare global {
  namespace Express {
    interface Request {
      apiKeyId?: string;
      startTime?: number;
    }
  }
}

/**
 * Check if a request should be logged (only MySQL query-related requests)
 */
function shouldLogRequest(req: Request): boolean {
  const path = req.path;
  const method = req.method;

  // Only log MySQL query execution endpoints
  if (path === '/api/query' && method === 'POST') return true;
  if (path === '/mcp' && method === 'POST') return true;

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

    // Log to database if API key is available
    if (req.apiKeyId) {
      try {
        const dbManager = getDatabaseManager();
        dbManager.logRequest(
          req.apiKeyId,
          req.path,
          req.method,
          req.body,
          body,
          res.statusCode,
          duration
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
