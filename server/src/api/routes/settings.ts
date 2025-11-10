import { Router, type Request, type Response } from 'express';
import { getDatabaseManager } from '../../db/database-manager.js';
import { loadEnvironment } from '../../config/environment.js';
import type { ActiveState, HealthStatus } from '../../types/index.js';

const router = Router();
const dbManager = getDatabaseManager();
const serverStartTime = Date.now();
const envConfig = loadEnvironment();

/**
 * GET /api/settings
 * Get server settings
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const transport = dbManager.getSetting('transport') || 'http';
    const httpPort = dbManager.getSetting('httpPort') || '3000';
    const mcpEnabled = dbManager.getMcpEnabled();

    const settings = {
      transport,
      httpPort: parseInt(httpPort),
      nodeVersion: process.version,
      mcpEnabled,
      inactivityTimeoutMs: envConfig.inactivityTimeoutMs,
    };

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/settings/mcp
 * Toggle MCP service enabled state
 */
router.put('/settings/mcp', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled field must be a boolean',
      });
    }

    dbManager.setMcpEnabled(enabled);

    return res.json({
      success: true,
      data: { mcpEnabled: enabled },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/active
 * Get current active state
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const state: ActiveState = {};

    const connection = dbManager.getActiveConnection();
    if (connection) {
      state.connectionId = connection.id;
      state.connectionName = connection.name;
      state.database = connection.activeDatabase;

      if (connection.activeDatabase) {
        const dbConfig = connection.databases[connection.activeDatabase];
        if (dbConfig) {
          state.permissions = dbConfig.permissions;
        }
      }
    }

    res.json({
      success: true,
      data: state,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint (no auth required)
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000);

    const health: HealthStatus = {
      status: 'healthy',
      uptime,
    };

    const connection = dbManager.getActiveConnection();
    if (connection) {
      health.activeConnection = connection.name;
      health.activeDatabase = connection.activeDatabase;
    }

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
