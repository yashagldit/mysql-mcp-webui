import type { Request, Response, NextFunction } from 'express';
import { getDatabaseManager } from '../../db/database-manager.js';

/**
 * Sanitize sensitive data before logging
 * Redacts passwords, API keys, tokens, and limits result size
 */
function sanitizeForLogging(data: any, maxLength: number = 10000): any {
  if (!data) return data;

  try {
    // Clone the data to avoid modifying the original
    const sanitized = JSON.parse(JSON.stringify(data));

    // List of sensitive field names to redact
    const sensitiveKeys = [
      'password',
      'apiKey',
      'api_key',
      'token',
      'key',
      'secret',
      'authorization',
      'auth',
      'currentPassword',
      'newPassword',
      'confirmPassword',
      'password_hash',
    ];

    // Recursively redact sensitive fields
    function redactSensitive(obj: any, depth: number = 0): any {
      // Prevent deep recursion
      if (depth > 10) return '[MAX_DEPTH]';

      if (Array.isArray(obj)) {
        // Limit array size in logs
        if (obj.length > 100) {
          return [...obj.slice(0, 100).map(item => redactSensitive(item, depth + 1)), `[...${obj.length - 100} more items]`];
        }
        return obj.map(item => redactSensitive(item, depth + 1));
      } else if (obj && typeof obj === 'object') {
        const redacted: any = {};
        for (const key in obj) {
          // Check if key name contains sensitive terms
          const isSensitive = sensitiveKeys.some(sk =>
            key.toLowerCase().includes(sk.toLowerCase())
          );

          if (isSensitive) {
            redacted[key] = '[REDACTED]';
          } else if (typeof obj[key] === 'string' && obj[key].length > 1000) {
            // Truncate long strings
            redacted[key] = obj[key].substring(0, 1000) + '... [TRUNCATED]';
          } else if (typeof obj[key] === 'object') {
            redacted[key] = redactSensitive(obj[key], depth + 1);
          } else {
            redacted[key] = obj[key];
          }
        }
        return redacted;
      }
      return obj;
    }

    const redacted = redactSensitive(sanitized);

    // Convert to string and limit total size
    let result = JSON.stringify(redacted);
    if (result.length > maxLength) {
      result = result.substring(0, maxLength) + '... [TRUNCATED]';
      // Try to parse back to keep it as valid JSON-ish
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    }

    return redacted;
  } catch (error) {
    // If sanitization fails, return a safe placeholder
    return { error: 'Failed to sanitize data for logging' };
  }
}

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
        // Security: Sanitize request and response data before logging
        dbManager.logRequest(
          req.apiKeyId || null,
          req.path,
          req.method,
          sanitizeForLogging(req.body),
          sanitizeForLogging(body),
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
