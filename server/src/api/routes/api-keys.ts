import { Router, type Request, type Response } from 'express';
import { getDatabaseManager } from '../../db/database-manager.js';
import { z } from 'zod';

const router = Router();
const dbManager = getDatabaseManager();

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
});

const UpdateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
});

/**
 * GET /api/keys
 * List all API keys
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const keys = dbManager.getAllApiKeys();

    // Remove the actual key value from response for security
    const sanitizedKeys = keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPreview: `${key.key.substring(0, 8)}...${key.key.substring(key.key.length - 8)}`,
      created_at: key.created_at,
      last_used_at: key.last_used_at,
      is_active: key.is_active,
    }));

    res.json({
      success: true,
      data: sanitizedKeys,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/keys
 * Create a new API key
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const validation = CreateApiKeySchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const apiKey = dbManager.createApiKey(validation.data.name);

    res.json({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key: apiKey.key, // Return full key only on creation
        created_at: apiKey.created_at,
        message: 'API key created successfully. Please save this key, it will not be shown again.',
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
 * GET /api/keys/:id
 * Get specific API key
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const apiKey = dbManager.getApiKey(req.params.id);

    if (!apiKey) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
      });
      return;
    }

    // Don't return the actual key
    res.json({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        keyPreview: `${apiKey.key.substring(0, 8)}...${apiKey.key.substring(apiKey.key.length - 8)}`,
        created_at: apiKey.created_at,
        last_used_at: apiKey.last_used_at,
        is_active: apiKey.is_active,
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
 * PUT /api/keys/:id
 * Update API key name
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const validation = UpdateApiKeySchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const apiKey = dbManager.getApiKey(req.params.id);

    if (!apiKey) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
      });
      return;
    }

    dbManager.updateApiKeyName(req.params.id, validation.data.name);

    res.json({
      success: true,
      data: {
        message: 'API key updated successfully',
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
 * POST /api/keys/:id/revoke
 * Revoke (deactivate) API key
 */
router.post('/:id/revoke', (req: Request, res: Response) => {
  try {
    const apiKey = dbManager.getApiKey(req.params.id);

    if (!apiKey) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
      });
      return;
    }

    dbManager.revokeApiKey(req.params.id);

    res.json({
      success: true,
      data: {
        message: 'API key revoked successfully',
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
 * DELETE /api/keys/:id
 * Delete API key
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const apiKey = dbManager.getApiKey(req.params.id);

    if (!apiKey) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
      });
      return;
    }

    // Prevent deletion of last active key
    const activeKeys = dbManager.getAllApiKeys().filter((k) => k.is_active);
    if (activeKeys.length === 1 && activeKeys[0].id === req.params.id) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete the last active API key',
      });
      return;
    }

    dbManager.deleteApiKey(req.params.id);

    res.json({
      success: true,
      data: {
        message: 'API key deleted successfully',
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
 * GET /api/keys/:id/logs
 * Get request logs for specific API key
 */
router.get('/:id/logs', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = dbManager.getRequestLogs(limit, offset, req.params.id);

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
