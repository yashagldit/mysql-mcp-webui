import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { CreateApiKeyRequest, UpdateApiKeyRequest } from '../types';

export const useApiKeys = () => {
  return useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => apiClient.getApiKeys(),
  });
};

export const useApiKey = (id: string) => {
  return useQuery({
    queryKey: ['apiKeys', id],
    queryFn: () => apiClient.getApiKey(id),
    enabled: !!id,
  });
};

export const useCreateApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateApiKeyRequest) => apiClient.createApiKey(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });
};

export const useUpdateApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: UpdateApiKeyRequest }) =>
      apiClient.updateApiKey(id, request),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      queryClient.invalidateQueries({ queryKey: ['apiKeys', id] });
    },
  });
};

export const useRevokeApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });
};

export const useApiKeyLogs = (id: string) => {
  return useQuery({
    queryKey: ['apiKeyLogs', id],
    queryFn: () => apiClient.getApiKeyLogs(id),
    enabled: !!id,
  });
};
