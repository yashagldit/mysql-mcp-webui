import { Router, type Request, type Response } from 'express';
import { getQueryExecutor } from '../../db/query-executor.js';
import { z } from 'zod';

const router = Router();
const queryExecutor = getQueryExecutor();

// Security constants for input validation
const MAX_PAGE_SIZE = 1000;
const MAX_OFFSET = 1000000;

/**
 * Validate and sanitize table name against actual database tables
 * Prevents SQL injection by ensuring the table exists
 */
async function validateTableName(tableName: string): Promise<void> {
  // First, check for basic validity - only allow alphanumeric, underscore, and dollar sign
  // (MySQL allows these in identifiers)
  if (!/^[a-zA-Z0-9_$]+$/.test(tableName)) {
    throw new Error('Invalid table name format. Only alphanumeric characters, underscore, and dollar sign are allowed.');
  }

  // Verify table exists in database by querying SHOW TABLES
  const result = await queryExecutor.executeQuery('SHOW TABLES');
  const validTables = result.rows.map(row => {
    const values = Object.values(row);
    return values[0] as string;
  });

  if (!validTables.includes(tableName)) {
    throw new Error('Table not found in database');
  }
}

/**
 * Escape identifier for MySQL queries
 * Wraps identifier in backticks and escapes any backticks within
 */
function escapeIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, '``')}\``;
}

/**
 * GET /api/browse/tables
 * List all tables in the active database with row counts
 */
router.get('/tables', async (req: Request, res: Response) => {
  try {
    // Get tables and views with their types
    const result = await queryExecutor.executeQuery('SHOW FULL TABLES');

    // Extract table names and types from the result
    // SHOW FULL TABLES returns two columns: table name and table type (BASE TABLE or VIEW)
    const allTables = result.rows.map(row => {
      const rowObj = row as Record<string, unknown>;
      const values = Object.values(rowObj);
      return {
        name: values[0] as string,
        type: values[1] as string,
      };
    });

    // Separate base tables from views
    const baseTables = allTables.filter(t => t.type === 'BASE TABLE');
    const views = allTables.filter(t => t.type === 'VIEW');

    // Get accurate row counts only for base tables using COUNT(*)
    // Build a UNION query to get all counts in one go for better performance
    let tables: Array<{ name: string; rowCount: number; isView: boolean }>;

    if (baseTables.length > 0) {
      // Properly escape table names to prevent SQL injection
      const countQueries = baseTables.map(t => {
        // Escape single quotes for the literal string
        const escapedNameLiteral = t.name.replace(/'/g, "''");
        // Escape identifier (backticks)
        const escapedTableName = escapeIdentifier(t.name);
        return `SELECT '${escapedNameLiteral}' as table_name, COUNT(*) as row_count FROM ${escapedTableName}`;
      });

      const unionQuery = countQueries.join(' UNION ALL ');
      const countResult = await queryExecutor.executeQuery(unionQuery);

      // Create a map of table name to row count
      const rowCountMap = new Map<string, number>();
      countResult.rows.forEach((row: any) => {
        rowCountMap.set(row.table_name, Number(row.row_count || 0));
      });

      // Build table list with row counts for base tables
      const baseTablesList = baseTables.map(t => ({
        name: t.name,
        rowCount: rowCountMap.get(t.name) || 0,
        isView: false,
      }));

      // Add views with rowCount 0 (we don't count views to avoid definer issues)
      const viewsList = views.map(v => ({
        name: v.name,
        rowCount: 0,
        isView: true,
      }));

      tables = [...baseTablesList, ...viewsList];
    } else {
      // No base tables, only views
      tables = views.map(v => ({
        name: v.name,
        rowCount: 0,
        isView: true,
      }));
    }

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

    // Validate table name to prevent SQL injection
    await validateTableName(tableName);

    // Get column information - using validated and escaped identifier
    const escapedTable = escapeIdentifier(tableName);
    const result = await queryExecutor.executeQuery(`DESCRIBE ${escapedTable}`);

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

    // Validate table name to prevent SQL injection
    await validateTableName(tableName);

    // Validate and sanitize pagination parameters
    let page = parseInt(req.query.page as string) || 1;
    let pageSize = parseInt(req.query.pageSize as string) || 50;

    // Security: Enforce bounds on pagination parameters
    if (page < 1) page = 1;
    if (pageSize < 1) pageSize = 50;
    if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

    const offset = (page - 1) * pageSize;

    // Security: Prevent offset overflow
    if (offset > MAX_OFFSET) {
      res.status(400).json({
        success: false,
        error: `Offset too large. Maximum allowed offset is ${MAX_OFFSET}`,
      });
      return;
    }

    const escapedTable = escapeIdentifier(tableName);

    // Get total count with validated table name
    const countResult = await queryExecutor.executeQuery(
      `SELECT COUNT(*) as total FROM ${escapedTable}`
    );
    const countRow = countResult.rows[0] as Record<string, unknown> | undefined;
    const total = Number(countRow?.total || 0);

    // Get paginated data - using parameterized values where possible
    // Note: MySQL doesn't support parameterized LIMIT/OFFSET, but we've validated they're safe integers
    const dataResult = await queryExecutor.executeQuery(
      `SELECT * FROM ${escapedTable} LIMIT ${pageSize} OFFSET ${offset}`
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

    // Validate table name to prevent SQL injection
    await validateTableName(tableName);

    // Get table info from information_schema
    // Using literal string escaping for the table name in WHERE clause
    const escapedTableLiteral = tableName.replace(/'/g, "''");
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
        AND table_name = '${escapedTableLiteral}'
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

    // Validate table name to prevent SQL injection
    await validateTableName(tableName);

    const escapedTable = escapeIdentifier(tableName);
    const result = await queryExecutor.executeQuery(`SHOW INDEX FROM ${escapedTable}`);

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
