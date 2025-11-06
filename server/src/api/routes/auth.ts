import { Router, type Request, type Response } from 'express';
import { getDatabaseManager } from '../../db/database-manager.js';
import { verifyPassword, generateJWT, hashPassword } from '../../config/auth-utils.js';
import { authMiddleware } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();
const dbManager = getDatabaseManager();

const UsernamePasswordLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const TokenLoginSchema = z.object({
  token: z.string().min(1),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(1),
});

/**
 * POST /api/auth/login
 * Login with username/password OR API token
 * Returns JWT token in httpOnly cookie and response body
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Try to parse as username/password
    const userPassValidation = UsernamePasswordLoginSchema.safeParse(req.body);
    if (userPassValidation.success) {
      const { username, password } = userPassValidation.data;

      // Get user by username
      const user = dbManager.getUserByUsername(username);
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Invalid username or password',
        });
        return;
      }

      // Check if user is active
      if (!user.is_active) {
        res.status(401).json({
          success: false,
          error: 'User account is disabled',
        });
        return;
      }

      // Verify password
      const isValid = await verifyPassword(password, user.password_hash);
      if (!isValid) {
        res.status(401).json({
          success: false,
          error: 'Invalid username or password',
        });
        return;
      }

      // Update last login time
      dbManager.updateUserLastLogin(user.id);

      // Generate JWT
      const token = generateJWT(user);

      // Set httpOnly cookie
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            must_change_password: user.must_change_password,
          },
          token, // Also return in body for flexibility
        },
      });
      return;
    }

    // Try to parse as token
    const tokenValidation = TokenLoginSchema.safeParse(req.body);
    if (tokenValidation.success) {
      const { token } = tokenValidation.data;

      // Verify API token
      const apiKey = dbManager.verifyApiKey(token);
      if (!apiKey) {
        res.status(401).json({
          success: false,
          error: 'Invalid API token',
        });
        return;
      }

      // For API token login, return success without JWT
      // (API tokens are used directly, not converted to JWT)
      res.json({
        success: true,
        data: {
          apiKey: {
            id: apiKey.id,
            name: apiKey.name,
          },
          message: 'API token verified successfully',
        },
      });
      return;
    }

    // Neither format matched
    res.status(400).json({
      success: false,
      error: 'Invalid request body. Provide either {username, password} or {token}',
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/auth/logout
 * Clear JWT cookie
 */
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('auth_token');
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 * Requires JWT authentication
 */
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  try {
    // User info is attached by auth middleware
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
      return;
    }

    const user = dbManager.getUserById(req.user.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
        is_active: user.is_active,
        must_change_password: user.must_change_password,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password
 * Requires JWT authentication
 */
router.post('/change-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
      return;
    }

    const validation = ChangePasswordSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = validation.data;

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      res.status(400).json({
        success: false,
        error: 'New password and confirmation do not match',
      });
      return;
    }

    // Get user
    const user = dbManager.getUserById(req.user.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // If user must change password, don't require current password
    if (!user.must_change_password) {
      if (!currentPassword) {
        res.status(400).json({
          success: false,
          error: 'Current password is required',
        });
        return;
      }

      // Verify current password
      const isValid = await verifyPassword(currentPassword, user.password_hash);
      if (!isValid) {
        res.status(401).json({
          success: false,
          error: 'Current password is incorrect',
        });
        return;
      }
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    dbManager.updateUserPassword(user.id, newPasswordHash);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/auth/check-token
 * Validate an API token
 * Public endpoint (no auth required)
 */
router.post('/check-token', (req: Request, res: Response) => {
  try {
    const validation = TokenLoginSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const { token } = validation.data;

    // Verify API token
    const apiKey = dbManager.verifyApiKey(token);
    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'Invalid API token',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        valid: true,
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
