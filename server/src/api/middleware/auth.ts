import type { Request, Response, NextFunction } from 'express';
import { getConfigManager } from '../../config/manager.js';
import { constantTimeCompare } from '../../config/crypto.js';

/**
 * Authentication middleware
 * Verifies Bearer token in Authorization header
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

    // Get server token from config
    const configManager = getConfigManager();
    const config = configManager.getConfig();

    // Constant-time comparison to prevent timing attacks
    if (!constantTimeCompare(token, config.serverToken)) {
      res.status(401).json({
        success: false,
        error: 'Invalid authentication token',
      });
      return;
    }

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
