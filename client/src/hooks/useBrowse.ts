import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { TableListResponse, TableStructureResponse, TableDataResponse, TableInfoResponse, TableIndexesResponse } from '../types';
import { useActiveState } from './useActiveState';

export function useTables() {
  const { data: activeState } = useActiveState();

  return useQuery<TableListResponse>({
    queryKey: ['tables', activeState?.connectionId, activeState?.database],
    queryFn: () => apiClient.getTables(),
    enabled: !!activeState?.database, // Only fetch if we have an active database
  });
}

export function useTableStructure(tableName: string | null) {
  const { data: activeState } = useActiveState();

  return useQuery<TableStructureResponse>({
    queryKey: ['tableStructure', activeState?.connectionId, activeState?.database, tableName],
    queryFn: () => apiClient.getTableStructure(tableName!),
    enabled: !!tableName && !!activeState?.database,
  });
}

export function useTableData(
  tableName: string | null,
  page: number = 1,
  pageSize: number = 50,
  sortColumn?: string,
  sortDirection?: 'asc' | 'desc'
) {
  const { data: activeState } = useActiveState();

  return useQuery<TableDataResponse>({
    queryKey: ['tableData', activeState?.connectionId, activeState?.database, tableName, page, pageSize, sortColumn, sortDirection],
    queryFn: () => apiClient.getTableData(tableName!, page, pageSize, sortColumn, sortDirection),
    enabled: !!tableName && !!activeState?.database,
  });
}

export function useTableInfo(tableName: string | null) {
  const { data: activeState } = useActiveState();

  return useQuery<TableInfoResponse>({
    queryKey: ['tableInfo', activeState?.connectionId, activeState?.database, tableName],
    queryFn: () => apiClient.getTableInfo(tableName!),
    enabled: !!tableName && !!activeState?.database,
  });
}

export function useTableIndexes(tableName: string | null) {
  const { data: activeState } = useActiveState();

  return useQuery<TableIndexesResponse>({
    queryKey: ['tableIndexes', activeState?.connectionId, activeState?.database, tableName],
    queryFn: () => apiClient.getTableIndexes(tableName!),
    enabled: !!tableName && !!activeState?.database,
  });
}
