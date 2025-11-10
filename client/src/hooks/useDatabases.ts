import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { UpdatePermissionsRequest } from '../types';

export const useDatabases = (connectionId: string) => {
  return useQuery({
    queryKey: ['databases', connectionId],
    queryFn: () => apiClient.getDatabases(connectionId),
    enabled: !!connectionId,
  });
};

export const useAllDatabases = () => {
  return useQuery({
    queryKey: ['databases', 'all'],
    queryFn: () => apiClient.getAllDatabases(),
  });
};

export const useActivateDatabase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ connectionId, dbName }: { connectionId: string; dbName: string }) =>
      apiClient.activateDatabase(connectionId, dbName),
    onSuccess: (_, { connectionId }) => {
      queryClient.invalidateQueries({ queryKey: ['databases', connectionId] });
      queryClient.invalidateQueries({ queryKey: ['databases', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['activeState'] });
    },
  });
};

export const useUpdatePermissions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      connectionId,
      dbName,
      permissions,
    }: {
      connectionId: string;
      dbName: string;
      permissions: UpdatePermissionsRequest;
    }) => apiClient.updatePermissions(connectionId, dbName, permissions),
    onSuccess: (_, { connectionId }) => {
      queryClient.invalidateQueries({ queryKey: ['databases', connectionId] });
      queryClient.invalidateQueries({ queryKey: ['databases', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['activeState'] });
    },
  });
};

export const useEnableDatabase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ connectionId, dbName }: { connectionId: string; dbName: string }) =>
      apiClient.enableDatabase(connectionId, dbName),
    onSuccess: (_, { connectionId }) => {
      queryClient.invalidateQueries({ queryKey: ['databases', connectionId] });
      queryClient.invalidateQueries({ queryKey: ['databases', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['activeState'] });
    },
  });
};

export const useDisableDatabase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ connectionId, dbName }: { connectionId: string; dbName: string }) =>
      apiClient.disableDatabase(connectionId, dbName),
    onSuccess: (_, { connectionId }) => {
      queryClient.invalidateQueries({ queryKey: ['databases', connectionId] });
      queryClient.invalidateQueries({ queryKey: ['databases', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['activeState'] });
    },
  });
};

export const useUpdateAlias = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ connectionId, dbName, newAlias }: { connectionId: string; dbName: string; newAlias: string }) =>
      apiClient.updateDatabaseAlias(connectionId, dbName, { newAlias }),
    onSuccess: (_, { connectionId }) => {
      queryClient.invalidateQueries({ queryKey: ['databases', connectionId] });
      queryClient.invalidateQueries({ queryKey: ['databases', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['activeState'] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });
};
