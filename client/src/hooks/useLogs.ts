import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export const useLogs = (params?: { limit?: number; offset?: number; apiKeyId?: string }) => {
  return useQuery({
    queryKey: ['logs', params],
    queryFn: () => apiClient.getLogs(params),
  });
};

export const useLogsStats = () => {
  return useQuery({
    queryKey: ['logsStats'],
    queryFn: () => apiClient.getLogsStats(),
  });
};

export const useClearLogs = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (days: number) => apiClient.clearOldLogs(days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['logsStats'] });
    },
  });
};
