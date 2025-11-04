import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { QueryRequest } from '../types';

export const useExecuteQuery = () => {
  return useMutation({
    mutationFn: (query: QueryRequest) => apiClient.executeQuery(query),
  });
};
