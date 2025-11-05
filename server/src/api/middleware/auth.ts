import type { Request, Response, NextFunction } from 'express';
import { getDatabaseManager } from '../../db/database-manager.js';
import { verifyJWT, extractTokenFromHeader } from '../../config/auth-utils.js';

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
 * Authentication middleware (Dual mode: JWT or API Key)
 * Tries authentication in this order:
 * 1. JWT in httpOnly cookie
 * 2. JWT in Authorization header
 * 3. API key in Authorization header
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const dbManager = getDatabaseManager();

    // 1. Try JWT from cookie
    const cookieToken = req.cookies?.auth_token;
    if (cookieToken) {
      const payload = verifyJWT(cookieToken);
      if (payload) {
        req.user = {
          userId: payload.userId,
          username: payload.username,
        };
        next();
        return;
      }
      // Cookie token is invalid/expired, clear it
      res.clearCookie('auth_token');
    }

    // 2. Try JWT or API key from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = extractTokenFromHeader(authHeader);

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Invalid authorization header format. Expected: Bearer <token>',
        });
        return;
      }

      // Try as JWT first
      const jwtPayload = verifyJWT(token);
      if (jwtPayload) {
        req.user = {
          userId: jwtPayload.userId,
          username: jwtPayload.username,
        };
        next();
        return;
      }

      // Try as API key
      const apiKey = dbManager.verifyApiKey(token);
      if (apiKey) {
        req.apiKeyId = apiKey.id;
        next();
        return;
      }
    }

    // No valid authentication found
    res.status(401).json({
      success: false,
      error: 'Authentication required. Provide valid JWT or API key.',
    });
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
 * Always requires authentication (localhost bypass removed for security)
 * Marks requests as from localhost for logging purposes
 */
export function smartAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const fromLocalhost = isLocalhost(req);

  // Mark request as from localhost for logging purposes
  req.isLocalhost = fromLocalhost;

  // Always require authentication
  authMiddleware(req, res, next);
}
