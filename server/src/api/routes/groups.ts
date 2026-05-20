import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getDatabaseManager } from '../../db/database-manager.js';
import { PermissionsSchema } from '../../types/index.js';

const router = Router();
const dbManager = getDatabaseManager();

const CreateGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  permissions: PermissionsSchema,
  databaseIds: z.array(z.string()).optional(),
});

const UpdateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  permissions: PermissionsSchema.optional(),
  databaseIds: z.array(z.string()).optional(),
});

/**
 * GET /api/groups
 * List all database groups
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const groups = dbManager.getAllGroups();
    res.json({ success: true, data: groups });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/groups
 * Create a new database group
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const validation = CreateGroupSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const { name, description, permissions, databaseIds } = validation.data;
    const group = dbManager.createGroup(name, description ?? null, permissions);

    if (databaseIds && databaseIds.length > 0) {
      dbManager.setGroupDatabases(group.id, databaseIds);
    }

    const full = dbManager.getGroup(group.id);
    res.json({ success: true, data: full });
  } catch (error: any) {
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ success: false, error: 'A group with this name already exists' });
      return;
    }
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/groups/:id
 * Get a group with details
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const group = dbManager.getGroup(req.params.id);
    if (!group) {
      res.status(404).json({ success: false, error: 'Group not found' });
      return;
    }
    res.json({ success: true, data: group });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/groups/:id
 * Update a group (name, description, permissions, and/or databases)
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const validation = UpdateGroupSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const existing = dbManager.getGroup(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Group not found' });
      return;
    }

    const { databaseIds, ...rest } = validation.data;
    if (rest.name !== undefined || rest.description !== undefined || rest.permissions !== undefined) {
      dbManager.updateGroup(req.params.id, rest);
    }

    if (databaseIds !== undefined) {
      dbManager.setGroupDatabases(req.params.id, databaseIds);
    }

    const updated = dbManager.getGroup(req.params.id);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ success: false, error: 'A group with this name already exists' });
      return;
    }
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/groups/:id
 * Delete a group (cascades to junction tables)
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = dbManager.getGroup(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Group not found' });
      return;
    }
    dbManager.deleteGroup(req.params.id);
    res.json({ success: true, data: { message: 'Group deleted' } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
