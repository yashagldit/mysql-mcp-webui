import { Router, type Request, type Response } from 'express';
import { getDatabaseManager } from '../../db/database-manager.js';

const router = Router();
const dbManager = getDatabaseManager();

/**
 * GET /api/logs
 * Get all request logs with pagination
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const apiKeyId = req.query.api_key_id as string | undefined;

    const logs = dbManager.getRequestLogs(limit, offset, apiKeyId);

    res.json({
      success: true,
      data: logs,
      pagination: {
        limit,
        offset,
        count: logs.length,
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
 * GET /api/logs/stats
 * Get usage statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = dbManager.getUsageStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/logs
 * Clear old logs
 */
router.delete('/', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    const deleted = dbManager.clearOldLogs(days);

    res.json({
      success: true,
      data: {
        message: `Deleted ${deleted} logs older than ${days} days`,
        deleted,
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
