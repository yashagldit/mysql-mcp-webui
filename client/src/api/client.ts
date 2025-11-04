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
    });

    // Request interceptor to add auth token
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
          // Clear invalid token
          this.setAuthToken(null);
          window.location.href = '/auth';
        }
        return Promise.reject(error);
      }
    );

    // Load token from localStorage
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

  // Database endpoints
  async getDatabases(connectionId: string): Promise<Database[]> {
    const { data } = await this.client.get<ApiResponse<Database[]>>(`/connections/${connectionId}/databases`);
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
  async getLogs(params?: { limit?: number; offset?: number; apiKeyId?: string }): Promise<{ logs: RequestLog[]; pagination: { limit: number; offset: number; count: number } }> {
    const { data } = await this.client.get<ApiResponse<RequestLog[]>>('/logs', { params });
    return {
      logs: data.data,
      pagination: { limit: params?.limit || 100, offset: params?.offset || 0, count: data.data.length },
    };
  }

  async getLogsStats(): Promise<LogsStats> {
    const { data } = await this.client.get<ApiResponse<LogsStats>>('/logs/stats');
    return data.data;
  }

  async clearOldLogs(days: number = 30): Promise<{ deleted: number; message: string }> {
    const { data } = await this.client.delete<ApiResponse<{ deleted: number; message: string }>>('/logs', { params: { days } });
    return data.data;
  }
}

export const apiClient = new ApiClient();
