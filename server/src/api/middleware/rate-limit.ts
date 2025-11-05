import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

/**
 * General API rate limiter
 * Limits requests per API key (or IP if no key)
 */
export function createApiRateLimiter(windowMs: number, maxRequests: number) {
  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Use API key ID if available (set by auth middleware)
      if ((req as any).apiKeyId) {
        return (req as any).apiKeyId;
      }
      // Fall back to IP address
      return req.ip || 'unknown';
    },
    skip: (req: Request) => {
      // Skip rate limiting for localhost in development
      if (process.env.NODE_ENV !== 'production') {
        const ip = req.ip || '';
        return ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1');
      }
      return false;
    },
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later.',
        retryAfter: res.getHeader('Retry-After'),
      });
    },
  });
}

/**
 * Query-specific rate limiter (stricter limits)
 * Used for database query endpoints
 */
export function createQueryRateLimiter(windowMs: number, maxRequests: number) {
  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Use API key ID if available
      if ((req as any).apiKeyId) {
        return `query:${(req as any).apiKeyId}`;
      }
      // Fall back to IP address
      return `query:${req.ip || 'unknown'}`;
    },
    skip: (req: Request) => {
      // Skip rate limiting for localhost in development
      if (process.env.NODE_ENV !== 'production') {
        const ip = req.ip || '';
        return ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1');
      }
      return false;
    },
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Too many query requests, please slow down.',
        retryAfter: res.getHeader('Retry-After'),
      });
    },
  });
}

/**
 * MCP-specific rate limiter
 * Used for MCP tool calls
 */
export function createMcpRateLimiter(windowMs: number, maxRequests: number) {
  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Use API key ID if available
      if ((req as any).apiKeyId) {
        return `mcp:${(req as any).apiKeyId}`;
      }
      // Fall back to IP address
      return `mcp:${req.ip || 'unknown'}`;
    },
    skip: (req: Request) => {
      // Skip rate limiting for localhost in development
      if (process.env.NODE_ENV !== 'production') {
        const ip = req.ip || '';
        return ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1');
      }
      return false;
    },
    handler: (req, res) => {
      res.status(429).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Too many MCP requests, please slow down.',
        },
        id: null,
      });
    },
  });
}
