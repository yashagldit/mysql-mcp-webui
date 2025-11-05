import { Router, type Request, type Response } from 'express';
import { getDatabaseManager } from '../../db/database-manager.js';
import { getConnectionManager } from '../../db/connection-manager.js';
import { getDatabaseDiscovery } from '../../db/discovery.js';
import { getMasterKey } from '../../config/master-key.js';
import {
  AddConnectionRequestSchema,
  UpdateConnectionRequestSchema,
  type ConnectionListItem,
  type TestConnectionResult,
  type DiscoverDatabasesResult,
} from '../../types/index.js';

const router = Router();
const dbManager = getDatabaseManager();
const connectionManager = getConnectionManager();
const databaseDiscovery = getDatabaseDiscovery();

/**
 * GET /api/connections
 * List all connections
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const connections: ConnectionListItem[] = [];

    for (const conn of dbManager.getAllConnections()) {
      connections.push({
        id: conn.id,
        name: conn.name,
        host: conn.host,
        port: conn.port,
        user: conn.user,
        isActive: conn.isActive,
        databaseCount: Object.keys(conn.databases).length,
        activeDatabase: conn.activeDatabase,
      });
    }

    res.json({
      success: true,
      data: connections,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/connections
 * Add new connection
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = AddConnectionRequestSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const request = validation.data;

    // Test connection first
    const testResult = await connectionManager.testConnection(
      {
        id: 'test',
        ...request,
        password: '', // Will be filled by testConnection
        isActive: false,
        databases: {},
      },
      request.password
    );

    // Add connection with discovered databases
    const masterKey = getMasterKey();
    const connectionId = dbManager.addConnection(request, masterKey, testResult.databases);

    res.json({
      success: true,
      data: {
        id: connectionId,
        message: 'Connection added successfully',
        discoveredDatabases: testResult.databases,
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
 * GET /api/connections/:id
 * Get specific connection
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const connection = dbManager.getConnection(req.params.id);

    if (!connection) {
      res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: connection.id,
        name: connection.name,
        host: connection.host,
        port: connection.port,
        user: connection.user,
        isActive: connection.isActive,
        databases: Object.values(connection.databases),
        activeDatabase: connection.activeDatabase,
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
 * PUT /api/connections/:id
 * Update connection
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const validation = UpdateConnectionRequestSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const masterKey = getMasterKey();
    dbManager.updateConnection(req.params.id, validation.data, masterKey);

    // If connection config changed, recreate pool
    if (validation.data.host || validation.data.port || validation.data.user || validation.data.password) {
      await connectionManager.recreatePool(req.params.id);
    }

    res.json({
      success: true,
      data: {
        message: 'Connection updated successfully',
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
 * DELETE /api/connections/:id
 * Delete connection
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await connectionManager.closePool(req.params.id);
    dbManager.deleteConnection(req.params.id);

    res.json({
      success: true,
      data: {
        message: 'Connection deleted successfully',
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
 * POST /api/connections/:id/test
 * Test connection
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const connection = dbManager.getConnection(req.params.id);

    if (!connection) {
      res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
      return;
    }

    const masterKey = getMasterKey();
    const password = dbManager.getDecryptedPassword(req.params.id, masterKey);
    const testResult = await connectionManager.testConnection(connection, password);

    const result: TestConnectionResult = {
      connected: true,
      databases: testResult.databases,
      latency: `${testResult.latency}ms`,
    };

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    });
  }
});

/**
 * POST /api/connections/:id/set-default
 * Set this connection as the default for new MCP instances
 * This does NOT affect currently running MCP instances
 */
router.post('/:id/set-default', async (req: Request, res: Response) => {
  try {
    const connection = dbManager.getConnection(req.params.id);

    if (!connection) {
      res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
      return;
    }

    dbManager.setDefaultConnectionId(req.params.id);

    res.json({
      success: true,
      data: {
        message: `Set ${connection.name} as default connection`,
        defaultConnection: req.params.id,
        note: 'This will be used by new MCP instances. Running instances are not affected.',
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
 * GET /api/connections/default
 * Get the current default connection
 */
router.get('/default', async (req: Request, res: Response) => {
  try {
    const defaultConnId = dbManager.getDefaultConnectionId();

    if (!defaultConnId) {
      res.json({
        success: true,
        data: null,
      });
      return;
    }

    const connection = dbManager.getConnection(defaultConnId);

    if (!connection) {
      res.json({
        success: true,
        data: null,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: connection.id,
        name: connection.name,
        host: connection.host,
        port: connection.port,
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
 * POST /api/connections/:id/activate
 * @deprecated Use /set-default instead
 * Switch to this connection (backwards compatibility)
 */
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const connection = dbManager.getConnection(req.params.id);

    if (!connection) {
      res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
      return;
    }

    dbManager.setDefaultConnectionId(req.params.id);

    res.json({
      success: true,
      data: {
        message: `Set ${connection.name} as default connection`,
        activeConnection: req.params.id,
        activeDatabase: connection.activeDatabase,
        deprecated: 'This endpoint is deprecated. Use /set-default instead.',
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
 * POST /api/connections/:id/discover
 * Discover databases from MySQL server
 */
router.post('/:id/discover', async (req: Request, res: Response) => {
  try {
    const connection = dbManager.getConnection(req.params.id);

    if (!connection) {
      res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
      return;
    }

    const pool = await connectionManager.getPool(req.params.id);
    const discovered = await databaseDiscovery.discoverDatabases(pool);

    const existing = Object.keys(connection.databases);
    const added = dbManager.addDatabases(req.params.id, discovered);

    const result: DiscoverDatabasesResult = {
      discovered,
      added,
      existing: existing.filter((db) => discovered.includes(db)),
    };

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
