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

    // Process logs for table view
    const processedLogs = logs.map(log => {
      let requestBody = null;
      let responseBody = null;

      // For MCP tool calls, always include the SQL query in request_body
      if (log.endpoint.startsWith('/mcp/')) {
        try {
          const parsed = log.request_body ? JSON.parse(log.request_body) : null;
          if (parsed && parsed.arguments && parsed.arguments.sql) {
            // Show SQL query for mysql_query tool
            requestBody = JSON.stringify({ sql: parsed.arguments.sql });
          } else if (parsed && parsed.tool) {
            // Show basic tool info for other tools
            requestBody = JSON.stringify({ tool: parsed.tool });
          }
        } catch (e) {
          // If parsing fails, leave as null
        }
      }

      return {
        ...log,
        request_body: requestBody,
        response_body: responseBody,
      };
    });

    res.json({
      success: true,
      data: processedLogs,
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
 * GET /api/logs/:id
 * Get full details for a single log entry
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const logId = parseInt(req.params.id);

    if (isNaN(logId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid log ID',
      });
      return;
    }

    // Get single log by ID
    const log = dbManager.getRequestLogById(logId);

    if (!log) {
      res.status(404).json({
        success: false,
        error: 'Log not found',
      });
      return;
    }

    // Return full log with complete request and response bodies
    res.json({
      success: true,
      data: log,
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
