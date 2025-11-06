// Connection types
export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  isActive: boolean;
  created_at: number;
}

export interface ConnectionWithDetails extends Connection {
  databaseCount?: number;
  activeDatabase?: string;
}

export interface CreateConnectionRequest {
  name: string;
  host: string;
  port: number;
  user: string;
  password: string;
}

export interface UpdateConnectionRequest {
  name?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
}

// Database types
export interface Database {
  name: string;
  isActive: boolean;
  isEnabled: boolean;
  permissions: DatabasePermissions;
  tableCount?: number;
  size?: string;
}

export interface DatabasePermissions {
  select: boolean;
  insert: boolean;
  update: boolean;
  delete: boolean;
  create: boolean;
  alter: boolean;
  drop: boolean;
  truncate: boolean;
}

export interface UpdatePermissionsRequest {
  permissions: DatabasePermissions;
}

// Query types
export interface QueryRequest {
  sql: string;
}

export interface QueryResult {
  rows: any[];
  fields: string[];
  rowCount: number;
  executionTime: string;
}

// Browse types
export interface TableInfo {
  name: string;
  rowCount: number;
  isView: boolean;
}

export interface TableListResponse {
  tables: TableInfo[];
}

export interface TableColumn {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
  Default: string | null;
  Extra: string;
}

export interface TableStructureResponse {
  tableName: string;
  columns: TableColumn[];
}

export interface TableDataResponse {
  tableName: string;
  rows: any[];
  columns: string[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface TableInfoResponse {
  table_name: string;
  engine: string;
  table_rows: number;
  avg_row_length: number;
  data_length: number;
  index_length: number;
  auto_increment: number | null;
  create_time: string;
  update_time: string | null;
  table_collation: string;
  table_comment: string;
}

export interface TableIndex {
  Table: string;
  Non_unique: number;
  Key_name: string;
  Seq_in_index: number;
  Column_name: string;
  Collation: string;
  Cardinality: number;
  Sub_part: number | null;
  Packed: string | null;
  Null: string;
  Index_type: string;
  Comment: string;
  Index_comment: string;
}

export interface TableIndexesResponse {
  tableName: string;
  indexes: TableIndex[];
}

// API Key types (v2.0)
export interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  created_at: number;
  last_used_at?: number;
  isActive: boolean;
}

export interface CreateApiKeyRequest {
  name: string;
}

export interface CreateApiKeyResponse {
  id: string;
  name: string;
  key: string;
  created_at: number;
  message: string;
}

export interface UpdateApiKeyRequest {
  name: string;
}

// Request Log types (v2.0)
export interface RequestLog {
  id: number;
  api_key_id: string;
  endpoint: string;
  method: string;
  request_body?: string;
  response_body?: string;
  status_code: number;
  duration_ms: number;
  timestamp: number;
}

export interface LogsStats {
  totalRequests: number;
  byApiKey: Array<{
    api_key_id: string;
    count: number;
  }>;
  byEndpoint: Array<{
    endpoint: string;
    count: number;
  }>;
}

// Settings types
export interface Settings {
  transport: 'stdio' | 'http';
  httpPort: number;
  nodeVersion: string;
  mcpEnabled: boolean;
}

export interface ActiveState {
  connectionId?: string;
  connectionName?: string;
  database?: string;
  permissions?: DatabasePermissions;
}

// Test connection response
export interface TestConnectionResponse {
  connected: boolean;
  databases: string[];
  latency: string;
}

// Discover databases response
export interface DiscoverDatabasesResponse {
  discovered: string[];
  added: string[];
  existing: string[];
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
}
