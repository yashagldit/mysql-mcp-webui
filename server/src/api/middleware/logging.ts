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
 * Request logging middleware
 * Logs all API requests with their responses to the database
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip logging for health check and static files
  if (req.path === '/api/health' || req.path.startsWith('/assets/')) {
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
