import { Router, type Request, type Response } from 'express';
import { getQueryExecutor } from '../../db/query-executor.js';
import { ExecuteQueryRequestSchema } from '../../types/index.js';

const router = Router();
const queryExecutor = getQueryExecutor();

/**
 * POST /api/query
 * Execute SQL query against active database
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = ExecuteQueryRequestSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const result = await queryExecutor.executeQuery(validation.data.sql);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
