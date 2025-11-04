import type { Request, Response, NextFunction } from 'express';
import { getDatabaseManager } from '../../db/database-manager.js';

// Extend Request to include apiKeyId and localhost flag
declare global {
  namespace Express {
    interface Request {
      apiKeyId?: string;
      isLocalhost?: boolean;
    }
  }
}

/**
 * Helper function to detect if request is from localhost
 */
function isLocalhost(req: Request): boolean {
  const ip = req.ip || req.socket.remoteAddress || '';

  // Normalize IPv6 localhost variations (e.g., ::ffff:127.0.0.1 -> 127.0.0.1)
  const normalizedIp = ip.replace('::ffff:', '');

  return (
    normalizedIp === '127.0.0.1' ||
    normalizedIp === '::1' ||
    normalizedIp === 'localhost' ||
    req.hostname === 'localhost'
  );
}

/**
 * Authentication middleware
 * Verifies Bearer token in Authorization header against API keys in database
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: 'Authorization header required',
      });
      return;
    }

    // Extract token from "Bearer <token>" format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        success: false,
        error: 'Invalid authorization header format. Expected: Bearer <token>',
      });
      return;
    }

    const token = parts[1];

    // Verify API key in database
    const dbManager = getDatabaseManager();
    const apiKey = dbManager.verifyApiKey(token);

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'Invalid or inactive API key',
      });
      return;
    }

    // Store API key ID in request for logging
    req.apiKeyId = apiKey.id;

    // Token is valid, proceed
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Optional authentication middleware
 * Allows requests without token but validates if present
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    // No auth header, allow through
    next();
    return;
  }

  // If auth header is present, validate it
  authMiddleware(req, res, next);
}

/**
 * Smart authentication middleware
 * Bypasses authentication for localhost requests (unless REQUIRE_AUTH_ON_LOCALHOST is true)
 * Requires authentication for remote requests
 */
export function smartAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requireAuthOnLocalhost = process.env.REQUIRE_AUTH_ON_LOCALHOST === 'true';
  const fromLocalhost = isLocalhost(req);

  // Mark request as from localhost for logging purposes
  req.isLocalhost = fromLocalhost;

  // If from localhost and auth not required, bypass authentication
  if (fromLocalhost && !requireAuthOnLocalhost) {
    console.log('[Auth] Bypassing authentication for localhost request');
    next();
    return;
  }

  // Otherwise, require authentication
  authMiddleware(req, res, next);
}
