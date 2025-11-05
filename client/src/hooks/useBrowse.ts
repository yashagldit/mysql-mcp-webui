import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { TableListResponse, TableStructureResponse, TableDataResponse, TableInfoResponse, TableIndexesResponse } from '../types';

export function useTables() {
  return useQuery<TableListResponse>({
    queryKey: ['tables'],
    queryFn: () => apiClient.getTables(),
  });
}

export function useTableStructure(tableName: string | null) {
  return useQuery<TableStructureResponse>({
    queryKey: ['tableStructure', tableName],
    queryFn: () => apiClient.getTableStructure(tableName!),
    enabled: !!tableName,
  });
}

export function useTableData(tableName: string | null, page: number = 1, pageSize: number = 50) {
  return useQuery<TableDataResponse>({
    queryKey: ['tableData', tableName, page, pageSize],
    queryFn: () => apiClient.getTableData(tableName!, page, pageSize),
    enabled: !!tableName,
  });
}

export function useTableInfo(tableName: string | null) {
  return useQuery<TableInfoResponse>({
    queryKey: ['tableInfo', tableName],
    queryFn: () => apiClient.getTableInfo(tableName!),
    enabled: !!tableName,
  });
}

export function useTableIndexes(tableName: string | null) {
  return useQuery<TableIndexesResponse>({
    queryKey: ['tableIndexes', tableName],
    queryFn: () => apiClient.getTableIndexes(tableName!),
    enabled: !!tableName,
  });
}
