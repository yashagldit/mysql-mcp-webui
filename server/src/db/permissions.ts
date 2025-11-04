import Parser from 'node-sql-parser';
import type { Permissions, QueryType } from '../types/index.js';
import { QueryTypePermissionMap } from '../types/index.js';

const parser = new Parser.Parser();

export class PermissionValidator {
  /**
   * Parse SQL query and extract query type
   */
  parseQuery(sql: string): QueryType {
    try {
      const ast = parser.astify(sql, { database: 'MySQL' });

      // Handle array of statements (multi-statement query)
      const statement = Array.isArray(ast) ? ast[0] : ast;

      if (!statement || !statement.type) {
        return 'UNKNOWN';
      }

      const type = statement.type.toUpperCase();

      // Map AST types to our QueryType
      switch (type) {
        case 'SELECT':
          return 'SELECT';
        case 'INSERT':
          return 'INSERT';
        case 'UPDATE':
          return 'UPDATE';
        case 'DELETE':
          return 'DELETE';
        case 'CREATE':
          return 'CREATE';
        case 'ALTER':
          return 'ALTER';
        case 'DROP':
          return 'DROP';
        case 'TRUNCATE':
          return 'TRUNCATE';
        default:
          return 'UNKNOWN';
      }
    } catch (error) {
      // If parsing fails, try to extract type from raw SQL
      return this.extractTypeFromRawSQL(sql);
    }
  }

  /**
   * Extract query type from raw SQL (fallback method)
   */
  private extractTypeFromRawSQL(sql: string): QueryType {
    const normalized = sql.trim().toUpperCase();

    if (normalized.startsWith('SELECT')) return 'SELECT';
    if (normalized.startsWith('INSERT')) return 'INSERT';
    if (normalized.startsWith('UPDATE')) return 'UPDATE';
    if (normalized.startsWith('DELETE')) return 'DELETE';
    if (normalized.startsWith('CREATE')) return 'CREATE';
    if (normalized.startsWith('ALTER')) return 'ALTER';
    if (normalized.startsWith('DROP')) return 'DROP';
    if (normalized.startsWith('TRUNCATE')) return 'TRUNCATE';

    return 'UNKNOWN';
  }

  /**
   * Validate if a query type is allowed based on permissions
   */
  validatePermission(queryType: QueryType, permissions: Permissions): { allowed: boolean; reason?: string } {
    // Map query type to permission key
    const permissionKey = QueryTypePermissionMap[queryType];

    if (permissionKey === null) {
      return {
        allowed: false,
        reason: `Unknown or unsupported query type: ${queryType}`,
      };
    }

    const isAllowed = permissions[permissionKey];

    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Permission denied: ${permissionKey.toUpperCase()} operation is not allowed for this database`,
      };
    }

    return { allowed: true };
  }

  /**
   * Validate SQL query against permissions
   */
  validateQuery(sql: string, permissions: Permissions): { allowed: boolean; queryType: QueryType; reason?: string } {
    const queryType = this.parseQuery(sql);
    const validation = this.validatePermission(queryType, permissions);

    return {
      allowed: validation.allowed,
      queryType,
      reason: validation.reason,
    };
  }

  /**
   * Check if a query type is a read operation
   */
  isReadOperation(queryType: QueryType): boolean {
    return queryType === 'SELECT';
  }

  /**
   * Check if a query type is a write operation
   */
  isWriteOperation(queryType: QueryType): boolean {
    return ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'].includes(queryType);
  }

  /**
   * Check if a query type is a DDL operation
   */
  isDDLOperation(queryType: QueryType): boolean {
    return ['CREATE', 'ALTER', 'DROP'].includes(queryType);
  }

  /**
   * Get a human-readable description of the required permission
   */
  getPermissionDescription(queryType: QueryType): string {
    const permissionKey = QueryTypePermissionMap[queryType];

    if (permissionKey === null) {
      return 'Unknown operation';
    }

    const descriptions: Record<keyof Permissions, string> = {
      select: 'Read data (SELECT)',
      insert: 'Insert new data (INSERT)',
      update: 'Update existing data (UPDATE)',
      delete: 'Delete data (DELETE)',
      create: 'Create database objects (CREATE)',
      alter: 'Modify database structure (ALTER)',
      drop: 'Drop database objects (DROP)',
      truncate: 'Truncate tables (TRUNCATE)',
    };

    return descriptions[permissionKey];
  }
}

// Singleton instance
let permissionValidatorInstance: PermissionValidator | null = null;

/**
 * Get or create the permission validator singleton
 */
export function getPermissionValidator(): PermissionValidator {
  if (!permissionValidatorInstance) {
    permissionValidatorInstance = new PermissionValidator();
  }
  return permissionValidatorInstance;
}
