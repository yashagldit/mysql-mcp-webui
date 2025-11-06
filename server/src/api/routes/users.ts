import { Router, type Request, type Response } from 'express';
import { getDatabaseManager } from '../../db/database-manager.js';
import { hashPassword } from '../../config/auth-utils.js';
import { z } from 'zod';

const router = Router();
const dbManager = getDatabaseManager();

const CreateUserSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  must_change_password: z.boolean().optional().default(true),
});

const UpdateUserSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  is_active: z.boolean().optional(),
  must_change_password: z.boolean().optional(),
});

const ResetPasswordSchema = z.object({
  newPassword: z.string().min(4, 'Password must be at least 4 characters'),
  must_change_password: z.boolean().optional().default(true),
});

/**
 * GET /api/users
 * List all users (requires authentication)
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const users = dbManager.getAllUsers();

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/users/:id
 * Get specific user (requires authentication)
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const user = dbManager.getUserById(req.params.id);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Don't return password hash
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/users
 * Create a new user (requires authentication)
 * Returns a temporary password
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = CreateUserSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const { username, password, must_change_password } = validation.data;

    // Check if user already exists
    const existing = dbManager.getUserByUsername(username);
    if (existing) {
      res.status(409).json({
        success: false,
        error: 'Username already exists',
      });
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = dbManager.createUser(username, passwordHash, must_change_password);

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        created_at: user.created_at,
        is_active: user.is_active,
        must_change_password: user.must_change_password,
        temporaryPassword: password, // Return the password only on creation
      },
      message: 'User created successfully. Please save the temporary password.',
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/users/:id
 * Update user details (requires authentication)
 * Cannot update password through this endpoint
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const validation = UpdateUserSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    // Check if user exists
    const user = dbManager.getUserById(req.params.id);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Check if trying to update username and it already exists
    if (validation.data.username && validation.data.username !== user.username) {
      const existing = dbManager.getUserByUsername(validation.data.username);
      if (existing) {
        res.status(409).json({
          success: false,
          error: 'Username already exists',
        });
        return;
      }
    }

    // Update user
    dbManager.updateUser(req.params.id, validation.data);

    // Get updated user
    const updated = dbManager.getUserById(req.params.id);

    res.json({
      success: true,
      data: {
        id: updated!.id,
        username: updated!.username,
        created_at: updated!.created_at,
        last_login_at: updated!.last_login_at,
        is_active: updated!.is_active,
        must_change_password: updated!.must_change_password,
      },
      message: 'User updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/users/:id/password
 * Reset user password (admin operation, requires authentication)
 */
router.put('/:id/password', async (req: Request, res: Response) => {
  try {
    const validation = ResetPasswordSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const { newPassword, must_change_password } = validation.data;

    // Check if user exists
    const user = dbManager.getUserById(req.params.id);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Prevent self-reset (use change-password endpoint instead)
    if (req.user && req.user.userId === req.params.id) {
      res.status(400).json({
        success: false,
        error: 'Cannot reset your own password. Use /api/auth/change-password instead.',
      });
      return;
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    dbManager.updateUserPassword(user.id, passwordHash);

    // Update must_change_password flag if specified
    if (must_change_password !== undefined) {
      dbManager.updateUser(user.id, { must_change_password });
    }

    res.json({
      success: true,
      data: {
        temporaryPassword: newPassword,
      },
      message: 'Password reset successfully. Please provide the temporary password to the user.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/users/:id
 * Delete a user (requires authentication)
 * Cannot delete yourself or the last active user
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    // Check if user exists
    const user = dbManager.getUserById(req.params.id);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Prevent self-deletion
    if (req.user && req.user.userId === req.params.id) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete your own account',
      });
      return;
    }

    // Prevent deleting the last active user
    const allUsers = dbManager.getAllUsers();
    const activeUsers = allUsers.filter((u) => u.is_active);
    if (activeUsers.length === 1 && user.is_active) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete the last active user',
      });
      return;
    }

    // Delete user
    dbManager.deleteUser(req.params.id);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
