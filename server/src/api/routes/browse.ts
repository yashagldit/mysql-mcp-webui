import { Router, type Request, type Response } from 'express';
import { getQueryExecutor } from '../../db/query-executor.js';
import { z } from 'zod';

const router = Router();
const queryExecutor = getQueryExecutor();

/**
 * GET /api/browse/tables
 * List all tables in the active database
 */
router.get('/tables', async (req: Request, res: Response) => {
  try {
    const result = await queryExecutor.executeQuery('SHOW TABLES');

    // Extract table names from the result
    const tables = result.rows.map(row => {
      const rowObj = row as Record<string, unknown>;
      return Object.values(rowObj)[0] as string;
    });

    res.json({
      success: true,
      data: { tables },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list tables',
    });
  }
});

/**
 * GET /api/browse/tables/:tableName/structure
 * Get the structure of a specific table
 */
router.get('/tables/:tableName/structure', async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;

    // Get column information
    const result = await queryExecutor.executeQuery(`DESCRIBE \`${tableName}\``);

    res.json({
      success: true,
      data: {
        tableName,
        columns: result.rows,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get table structure',
    });
  }
});

/**
 * GET /api/browse/tables/:tableName/data
 * Get data from a specific table with pagination
 */
router.get('/tables/:tableName/data', async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const offset = (page - 1) * pageSize;

    // Get total count
    const countResult = await queryExecutor.executeQuery(
      `SELECT COUNT(*) as total FROM \`${tableName}\``
    );
    const countRow = countResult.rows[0] as Record<string, unknown> | undefined;
    const total = Number(countRow?.total || 0);

    // Get paginated data
    const dataResult = await queryExecutor.executeQuery(
      `SELECT * FROM \`${tableName}\` LIMIT ${pageSize} OFFSET ${offset}`
    );

    res.json({
      success: true,
      data: {
        tableName,
        rows: dataResult.rows,
        columns: dataResult.fields,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get table data',
    });
  }
});

/**
 * GET /api/browse/tables/:tableName/info
 * Get detailed information about a table (row count, size, etc.)
 */
router.get('/tables/:tableName/info', async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;

    // Get table info from information_schema
    const result = await queryExecutor.executeQuery(`
      SELECT
        table_name,
        engine,
        table_rows,
        avg_row_length,
        data_length,
        index_length,
        auto_increment,
        create_time,
        update_time,
        table_collation,
        table_comment
      FROM information_schema.TABLES
      WHERE table_schema = DATABASE()
        AND table_name = '${tableName}'
    `);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Table not found',
      });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get table info',
    });
  }
});

/**
 * GET /api/browse/tables/:tableName/indexes
 * Get indexes for a specific table
 */
router.get('/tables/:tableName/indexes', async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;

    const result = await queryExecutor.executeQuery(`SHOW INDEX FROM \`${tableName}\``);

    res.json({
      success: true,
      data: {
        tableName,
        indexes: result.rows,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get table indexes',
    });
  }
});

export default router;
