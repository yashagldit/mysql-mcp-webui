import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  ApiResponse,
  Connection,
  ConnectionWithDetails,
  CreateConnectionRequest,
  UpdateConnectionRequest,
  TestConnectionResponse,
  DiscoverDatabasesResponse,
  Database,
  UpdatePermissionsRequest,
  UpdateAliasRequest,
  QueryRequest,
  QueryResult,
  Settings,
  ActiveState,
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  UpdateApiKeyRequest,
  RequestLog,
  LogsStats,
  TableListResponse,
  TableStructureResponse,
  TableDataResponse,
  TableInfoResponse,
  TableIndexesResponse,
} from '../types';

class ApiClient {
  private client: AxiosInstance;
  private authToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Enable cookie support for JWT auth
    });

    // Request interceptor to add auth token (for API token mode)
    this.client.interceptors.request.use((config) => {
      if (this.authToken) {
        config.headers.Authorization = `Bearer ${this.authToken}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Only redirect if not already on auth page and not a login request
          const isLoginRequest = error.config?.url?.includes('/auth/login');
          if (!isLoginRequest && window.location.pathname !== '/auth') {
            // Clear any stored token
            this.setAuthToken(null);
            // Redirect to login
            window.location.href = '/auth';
          }
        }
        return Promise.reject(error);
      }
    );

    // Load token from localStorage (for API token mode)
    const savedToken = localStorage.getItem('apiToken');
    if (savedToken) {
      this.authToken = savedToken;
    }
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
    if (token) {
      localStorage.setItem('apiToken', token);
    } else {
      localStorage.removeItem('apiToken');
    }
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  // Generic HTTP methods (for use by AuthContext and other components)
  get(url: string, config?: any) {
    return this.client.get(url, config);
  }

  post(url: string, data?: any, config?: any) {
    return this.client.post(url, data, config);
  }

  put(url: string, data?: any, config?: any) {
    return this.client.put(url, data, config);
  }

  delete(url: string, config?: any) {
    return this.client.delete(url, config);
  }

  // Connection endpoints
  async getConnections(): Promise<ConnectionWithDetails[]> {
    const { data } = await this.client.get<ApiResponse<ConnectionWithDetails[]>>('/connections');
    return data.data;
  }

  async getConnection(id: string): Promise<Connection> {
    const { data } = await this.client.get<ApiResponse<Connection>>(`/connections/${id}`);
    return data.data;
  }

  async createConnection(connection: CreateConnectionRequest): Promise<{ id: string; message: string }> {
    const { data } = await this.client.post<ApiResponse<{ id: string; message: string }>>('/connections', connection);
    return data.data;
  }

  async updateConnection(id: string, updates: UpdateConnectionRequest): Promise<{ message: string }> {
    const { data } = await this.client.put<ApiResponse<{ message: string }>>(`/connections/${id}`, updates);
    return data.data;
  }

  async deleteConnection(id: string): Promise<{ message: string }> {
    const { data } = await this.client.delete<ApiResponse<{ message: string }>>(`/connections/${id}`);
    return data.data;
  }

  async testConnection(id: string): Promise<TestConnectionResponse> {
    const { data } = await this.client.post<ApiResponse<TestConnectionResponse>>(`/connections/${id}/test`);
    return data.data;
  }

  async activateConnection(id: string): Promise<{ message: string; activeConnection: string; activeDatabase?: string }> {
    const { data } = await this.client.post<ApiResponse<any>>(`/connections/${id}/activate`);
    return data.data;
  }

  async discoverDatabases(id: string): Promise<DiscoverDatabasesResponse> {
    const { data } = await this.client.post<ApiResponse<DiscoverDatabasesResponse>>(`/connections/${id}/discover`);
    return data.data;
  }

  async enableConnection(id: string): Promise<{ message: string }> {
    const { data } = await this.client.put<ApiResponse<{ message: string }>>(`/connections/${id}/enable`);
    return data.data;
  }

  async disableConnection(id: string): Promise<{ message: string; switchedTo: string | null }> {
    const { data } = await this.client.put<ApiResponse<{ message: string; switchedTo: string | null }>>(`/connections/${id}/disable`);
    return data.data;
  }

  // Database endpoints
  async getDatabases(connectionId: string): Promise<Database[]> {
    const { data } = await this.client.get<ApiResponse<Database[]>>(`/connections/${connectionId}/databases`);
    return data.data;
  }

  async getAllDatabases(): Promise<Array<{
    connectionId: string;
    connectionName: string;
    database: string;
    alias: string;
    isActive: boolean;
    isCurrent: boolean;
    isEnabled: boolean;
    permissions: any;
    lastAccessed: number;
  }>> {
    const { data } = await this.client.get<ApiResponse<any>>('/databases');
    return data.data;
  }

  async activateDatabase(connectionId: string, dbName: string): Promise<{ message: string; activeDatabase: string }> {
    const { data } = await this.client.post<ApiResponse<any>>(`/connections/${connectionId}/databases/${dbName}/activate`);
    return data.data;
  }

  async updatePermissions(connectionId: string, dbName: string, permissions: UpdatePermissionsRequest): Promise<{ message: string }> {
    const { data } = await this.client.put<ApiResponse<{ message: string }>>(`/connections/${connectionId}/databases/${dbName}/permissions`, permissions);
    return data.data;
  }

  async enableDatabase(connectionId: string, dbName: string): Promise<{ message: string }> {
    const { data } = await this.client.put<ApiResponse<{ message: string }>>(`/connections/${connectionId}/databases/${dbName}/enable`);
    return data.data;
  }

  async disableDatabase(connectionId: string, dbName: string): Promise<{ message: string }> {
    const { data} = await this.client.put<ApiResponse<{ message: string }>>(`/connections/${connectionId}/databases/${dbName}/disable`);
    return data.data;
  }

  async updateDatabaseAlias(connectionId: string, dbName: string, request: UpdateAliasRequest): Promise<{ message: string; alias: string }> {
    const { data } = await this.client.put<ApiResponse<{ message: string; alias: string }>>(`/connections/${connectionId}/databases/${dbName}/alias`, request);
    return data.data;
  }

  // Query endpoint
  async executeQuery(query: QueryRequest): Promise<QueryResult> {
    const { data } = await this.client.post<ApiResponse<QueryResult>>('/query', query);
    return data.data;
  }

  // Settings endpoints
  async getSettings(): Promise<Settings> {
    const { data } = await this.client.get<ApiResponse<Settings>>('/settings');
    return data.data;
  }

  async toggleMcp(enabled: boolean): Promise<{ mcpEnabled: boolean }> {
    const { data } = await this.client.put<ApiResponse<{ mcpEnabled: boolean }>>('/settings/mcp', { enabled });
    return data.data;
  }

  async getActiveState(): Promise<ActiveState> {
    const { data } = await this.client.get<ApiResponse<ActiveState>>('/active');
    return data.data;
  }

  async getHealth(): Promise<{ status: string; uptime: number; activeConnection?: string; activeDatabase?: string }> {
    const { data } = await this.client.get('/health');
    return data;
  }

  // API Key endpoints (v2.0)
  async getApiKeys(): Promise<ApiKey[]> {
    const { data } = await this.client.get<ApiResponse<ApiKey[]>>('/keys');
    return data.data;
  }

  async getApiKey(id: string): Promise<ApiKey> {
    const { data } = await this.client.get<ApiResponse<ApiKey>>(`/keys/${id}`);
    return data.data;
  }

  async createApiKey(request: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    const { data } = await this.client.post<ApiResponse<CreateApiKeyResponse>>('/keys', request);
    return data.data;
  }

  async updateApiKey(id: string, request: UpdateApiKeyRequest): Promise<{ message: string }> {
    const { data } = await this.client.put<ApiResponse<{ message: string }>>(`/keys/${id}`, request);
    return data.data;
  }

  async revokeApiKey(id: string): Promise<{ message: string }> {
    const { data } = await this.client.delete<ApiResponse<{ message: string }>>(`/keys/${id}`);
    return data.data;
  }

  async getApiKeyLogs(id: string): Promise<RequestLog[]> {
    const { data } = await this.client.get<ApiResponse<RequestLog[]>>(`/keys/${id}/logs`);
    return data.data;
  }

  // Request logs endpoints (v2.0)
  async getLogs(params?: { limit?: number; offset?: number; apiKeyId?: string; search?: string }): Promise<{ logs: RequestLog[]; pagination: { limit: number; offset: number; count: number; total: number } }> {
    const { data } = await this.client.get<any>('/logs', { params });
    return {
      logs: data.data,
      pagination: data.pagination || { limit: params?.limit || 100, offset: params?.offset || 0, count: data.data.length, total: data.data.length },
    };
  }

  async getLogById(id: number): Promise<RequestLog> {
    const { data } = await this.client.get<ApiResponse<RequestLog>>(`/logs/${id}`);
    return data.data;
  }

  async getLogsStats(): Promise<LogsStats> {
    const { data } = await this.client.get<ApiResponse<LogsStats>>('/logs/stats');
    return data.data;
  }

  async clearOldLogs(days: number = 30): Promise<{ deleted: number; message: string }> {
    const { data } = await this.client.delete<ApiResponse<{ deleted: number; message: string }>>('/logs', { params: { days } });
    return data.data;
  }

  // Browse endpoints
  async getTables(): Promise<TableListResponse> {
    const { data } = await this.client.get<ApiResponse<TableListResponse>>('/browse/tables');
    return data.data;
  }

  async getTableStructure(tableName: string): Promise<TableStructureResponse> {
    const { data } = await this.client.get<ApiResponse<TableStructureResponse>>(`/browse/tables/${encodeURIComponent(tableName)}/structure`);
    return data.data;
  }

  async getTableData(
    tableName: string,
    page: number = 1,
    pageSize: number = 50,
    sortColumn?: string,
    sortDirection?: 'asc' | 'desc'
  ): Promise<TableDataResponse> {
    const params: any = { page, pageSize };

    if (sortColumn && sortDirection) {
      params.sortColumn = sortColumn;
      params.sortDirection = sortDirection;
    }

    const { data } = await this.client.get<ApiResponse<TableDataResponse>>(
      `/browse/tables/${encodeURIComponent(tableName)}/data`,
      { params }
    );
    return data.data;
  }

  async getTableInfo(tableName: string): Promise<TableInfoResponse> {
    const { data } = await this.client.get<ApiResponse<TableInfoResponse>>(`/browse/tables/${encodeURIComponent(tableName)}/info`);
    return data.data;
  }

  async getTableIndexes(tableName: string): Promise<TableIndexesResponse> {
    const { data } = await this.client.get<ApiResponse<TableIndexesResponse>>(`/browse/tables/${encodeURIComponent(tableName)}/indexes`);
    return data.data;
  }
}

export const apiClient = new ApiClient();
