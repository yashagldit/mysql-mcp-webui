import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { CreateGroupRequest, UpdateGroupRequest } from '../types';

export const useGroups = () => {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => apiClient.getGroups(),
  });
};

export const useGroup = (id: string | null) => {
  return useQuery({
    queryKey: ['groups', id],
    queryFn: () => apiClient.getGroup(id!),
    enabled: !!id,
  });
};

export const useCreateGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateGroupRequest) => apiClient.createGroup(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });
};

export const useUpdateGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: UpdateGroupRequest }) =>
      apiClient.updateGroup(id, request),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', id] });
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });
};

export const useDeleteGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });
};

export const useApiKeyGroups = (apiKeyId: string | null) => {
  return useQuery({
    queryKey: ['apiKeyGroups', apiKeyId],
    queryFn: () => apiClient.getApiKeyGroups(apiKeyId!),
    enabled: !!apiKeyId,
  });
};

export const useSetApiKeyGroups = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ apiKeyId, groupIds }: { apiKeyId: string; groupIds: string[] }) =>
      apiClient.setApiKeyGroups(apiKeyId, groupIds),
    onSuccess: (_, { apiKeyId }) => {
      queryClient.invalidateQueries({ queryKey: ['apiKeyGroups', apiKeyId] });
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
};
