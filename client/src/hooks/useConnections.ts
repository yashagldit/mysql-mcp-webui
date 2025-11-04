import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type {
  CreateConnectionRequest,
  UpdateConnectionRequest,
} from '../types';

export const useConnections = () => {
  return useQuery({
    queryKey: ['connections'],
    queryFn: () => apiClient.getConnections(),
  });
};

export const useConnection = (id: string) => {
  return useQuery({
    queryKey: ['connections', id],
    queryFn: () => apiClient.getConnection(id),
    enabled: !!id,
  });
};

export const useCreateConnection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (connection: CreateConnectionRequest) =>
      apiClient.createConnection(connection),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });
};

export const useUpdateConnection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateConnectionRequest }) =>
      apiClient.updateConnection(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connections', id] });
    },
  });
};

export const useDeleteConnection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['activeState'] });
    },
  });
};

export const useTestConnection = () => {
  return useMutation({
    mutationFn: (id: string) => apiClient.testConnection(id),
  });
};

export const useActivateConnection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.activateConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['activeState'] });
    },
  });
};

export const useDiscoverDatabases = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.discoverDatabases(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['databases', id] });
    },
  });
};
