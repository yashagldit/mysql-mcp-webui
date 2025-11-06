import { z } from 'zod';

// ============================================================================
// Permissions
// ============================================================================

export interface Permissions {
  select: boolean;
  insert: boolean;
  update: boolean;
  delete: boolean;
  alter: boolean;
  drop: boolean;
  create: boolean;
  truncate: boolean;
}

export const PermissionsSchema = z.object({
  select: z.boolean(),
  insert: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
  alter: z.boolean(),
  drop: z.boolean(),
  create: z.boolean(),
  truncate: z.boolean(),
});

export const defaultPermissions: Permissions = {
  select: true,
  insert: false,
  update: false,
  delete: false,
  alter: false,
  drop: false,
  create: false,
  truncate: false,
};

// ============================================================================
// Database Configuration
// ============================================================================

export interface DatabaseConfig {
  name: string;
  permissions: Permissions;
  isEnabled: boolean;
}

export const DatabaseConfigSchema = z.object({
  name: z.string(),
  permissions: PermissionsSchema,
  isEnabled: z.boolean(),
});

// ============================================================================
// Encrypted Data
// ============================================================================

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

export const EncryptedDataSchema = z.object({
  encrypted: z.string(),
  iv: z.string(),
  authTag: z.string(),
});

// ============================================================================
// Connection Configuration
// ============================================================================

export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  password: string; // JSON stringified EncryptedData
  isActive: boolean;
  databases: Record<string, DatabaseConfig>;
  activeDatabase?: string;
}

export const ConnectionConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  host: z.string(),
  port: z.number().int().min(1).max(65535),
  user: z.string(),
  password: z.string(), // Will be validated as JSON string of EncryptedData
  isActive: z.boolean(),
  databases: z.record(z.string(), DatabaseConfigSchema),
  activeDatabase: z.string().optional(),
});

// ============================================================================
// Main Configuration
// ============================================================================

export interface Config {
  serverToken: string;
  transport: 'stdio' | 'http';
  httpPort: number;
  connections: Record<string, ConnectionConfig>;
  activeConnection?: string;
}

export const ConfigSchema = z.object({
  serverToken: z.string().min(32),
  transport: z.enum(['stdio', 'http']),
  httpPort: z.number().int().min(1).max(65535),
  connections: z.record(z.string(), ConnectionConfigSchema),
  activeConnection: z.string().optional(),
});

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface AddConnectionRequest {
  name: string;
  host: string;
  port: number;
  user: string;
  password: string; // Plain text, will be encrypted
}

export const AddConnectionRequestSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  user: z.string().min(1),
  password: z.string().min(1),
});

export interface UpdateConnectionRequest {
  name?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string; // Plain text, will be encrypted if provided
}

export const UpdateConnectionRequestSchema = z.object({
  name: z.string().min(1).optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  user: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
});

export interface UpdatePermissionsRequest {
  permissions: Permissions;
}

export const UpdatePermissionsRequestSchema = z.object({
  permissions: PermissionsSchema,
});

export interface ExecuteQueryRequest {
  sql: string;
}

export const ExecuteQueryRequestSchema = z.object({
  sql: z.string().min(1),
});

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ConnectionListItem {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  isActive: boolean;
  databaseCount: number;
  activeDatabase?: string;
}

export interface TestConnectionResult {
  connected: boolean;
  databases: string[];
  latency: string;
}

export interface DiscoverDatabasesResult {
  discovered: string[];
  added: string[];
  existing: string[];
}

export interface DatabaseListItem {
  name: string;
  isActive: boolean;
  isEnabled: boolean;
  permissions: Permissions;
  tableCount?: number;
  size?: string;
}

export interface QueryResult {
  rows: unknown[];
  fields: string[];
  rowCount: number;
  executionTime: string;
}

export interface ActiveState {
  connectionId?: string;
  connectionName?: string;
  database?: string;
  permissions?: Permissions;
}

export interface ServerSettings {
  serverToken: string;
  transport: 'stdio' | 'http';
  httpPort: number;
  nodeVersion: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  uptime: number;
  activeConnection?: string;
  activeDatabase?: string;
}

// ============================================================================
// Query Types
// ============================================================================

export type QueryType =
  | 'SELECT'
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'CREATE'
  | 'ALTER'
  | 'DROP'
  | 'TRUNCATE'
  | 'SHOW'
  | 'DESCRIBE'
  | 'EXPLAIN'
  | 'USE'
  | 'SET'
  | 'UNKNOWN';

export const QueryTypePermissionMap: Record<QueryType, keyof Permissions | null> = {
  SELECT: 'select',
  INSERT: 'insert',
  UPDATE: 'update',
  DELETE: 'delete',
  CREATE: 'create',
  ALTER: 'alter',
  DROP: 'drop',
  TRUNCATE: 'truncate',
  SHOW: 'select',
  DESCRIBE: 'select',
  EXPLAIN: 'select',
  USE: 'select',
  SET: 'select',
  UNKNOWN: null,
};

// ============================================================================
// Express Request Extensions
// ============================================================================

declare global {
  namespace Express {
    interface Request {
      apiKeyId?: string;
      user?: {
        userId: string;
        username: string;
      };
      isLocalhost?: boolean;
      startTime?: number;
    }
  }
}
