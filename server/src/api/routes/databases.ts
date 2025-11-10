import { Router, type Request, type Response } from 'express';
import { getDatabaseManager } from '../../db/database-manager.js';
import { getConnectionManager } from '../../db/connection-manager.js';
import { getDatabaseDiscovery } from '../../db/discovery.js';
import {
  UpdatePermissionsRequestSchema,
  type DatabaseListItem,
} from '../../types/index.js';

const router = Router();
const dbManager = getDatabaseManager();
const connectionManager = getConnectionManager();
const databaseDiscovery = getDatabaseDiscovery();

/**
 * GET /api/connections/:id/databases
 * List databases for a connection
 */
router.get('/:id/databases', async (req: Request, res: Response) => {
  try {
    const connection = dbManager.getConnection(req.params.id);

    if (!connection) {
      res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
      return;
    }

    const databases: DatabaseListItem[] = [];

    // Get metadata if requested
    const includeMetadata = req.query.include_metadata === 'true';

    if (includeMetadata) {
      try {
        const pool = await connectionManager.getPool(req.params.id);

        for (const [dbName, dbConfig] of Object.entries(connection.databases)) {
          try {
            const metadata = await databaseDiscovery.getDatabaseMetadata(pool, dbName);
            databases.push({
              name: dbConfig.name,
              alias: dbConfig.alias || dbConfig.name, // Use alias or fallback to name
              isActive: connection.activeDatabase === dbConfig.name,
              isEnabled: dbConfig.isEnabled,
              permissions: dbConfig.permissions,
              tableCount: metadata.tableCount,
              size: metadata.sizeFormatted,
            });
          } catch (error) {
            // If metadata fails, just include basic info
            databases.push({
              name: dbConfig.name,
              alias: dbConfig.alias || dbConfig.name,
              isActive: connection.activeDatabase === dbConfig.name,
              isEnabled: dbConfig.isEnabled,
              permissions: dbConfig.permissions,
            });
          }
        }
      } catch (error) {
        // If connection fails, just return basic info
        for (const dbConfig of Object.values(connection.databases)) {
          databases.push({
            name: dbConfig.name,
            alias: dbConfig.alias || dbConfig.name,
            isActive: connection.activeDatabase === dbConfig.name,
            isEnabled: dbConfig.isEnabled,
            permissions: dbConfig.permissions,
          });
        }
      }
    } else {
      for (const dbConfig of Object.values(connection.databases)) {
        databases.push({
          name: dbConfig.name,
          alias: dbConfig.alias || dbConfig.name,
          isActive: connection.activeDatabase === dbConfig.name,
          isEnabled: dbConfig.isEnabled,
          permissions: dbConfig.permissions,
        });
      }
    }

    res.json({
      success: true,
      data: databases,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/connections/:connId/databases/:dbName/activate
 * Switch active database
 */
router.post('/:connId/databases/:dbName/activate', async (req: Request, res: Response) => {
  try {
    const { connId, dbName } = req.params;

    const connection = dbManager.getConnection(connId);

    if (!connection) {
      res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
      return;
    }

    if (!connection.databases[dbName]) {
      res.status(404).json({
        success: false,
        error: 'Database not found',
      });
      return;
    }

    // Check if database is enabled
    if (!connection.databases[dbName].isEnabled) {
      res.status(400).json({
        success: false,
        error: 'Cannot activate a disabled database. Please enable it first.',
      });
      return;
    }

    // Switch the database in SQLite (persistent storage)
    dbManager.switchDatabase(connId, dbName);

    // Update in-memory state in ConnectionManager
    connectionManager.setActiveConnectionId(connId);
    connectionManager.setActiveDatabase(connId, dbName);

    // Also set this connection as the default so /api/active returns the correct state
    // This ensures the UI reflects the database switch immediately
    dbManager.setDefaultConnectionId(connId);

    res.json({
      success: true,
      data: {
        message: `Switched to database: ${dbName}`,
        activeDatabase: dbName,
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
 * PUT /api/connections/:connId/databases/:dbName/permissions
 * Update database permissions
 */
router.put('/:connId/databases/:dbName/permissions', async (req: Request, res: Response) => {
  try {
    const { connId, dbName } = req.params;

    const validation = UpdatePermissionsRequestSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    dbManager.updateDatabasePermissions(connId, dbName, validation.data.permissions);

    res.json({
      success: true,
      data: {
        message: 'Permissions updated successfully',
        permissions: validation.data.permissions,
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
 * PUT /api/connections/:connId/databases/:dbName/enable
 * Enable a database (make it accessible via MCP)
 */
router.put('/:connId/databases/:dbName/enable', async (req: Request, res: Response) => {
  try {
    const { connId, dbName } = req.params;

    const connection = dbManager.getConnection(connId);

    if (!connection) {
      res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
      return;
    }

    if (!connection.databases[dbName]) {
      res.status(404).json({
        success: false,
        error: 'Database not found',
      });
      return;
    }

    dbManager.enableDatabase(connId, dbName);

    res.json({
      success: true,
      data: {
        message: `Database '${dbName}' enabled successfully`,
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
 * PUT /api/connections/:connId/databases/:dbName/disable
 * Disable a database (hide it from MCP)
 */
router.put('/:connId/databases/:dbName/disable', async (req: Request, res: Response) => {
  try {
    const { connId, dbName } = req.params;

    const connection = dbManager.getConnection(connId);

    if (!connection) {
      res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
      return;
    }

    if (!connection.databases[dbName]) {
      res.status(404).json({
        success: false,
        error: 'Database not found',
      });
      return;
    }

    dbManager.disableDatabase(connId, dbName);

    res.json({
      success: true,
      data: {
        message: `Database '${dbName}' disabled successfully`,
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
