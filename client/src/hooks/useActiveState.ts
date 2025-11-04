import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export const useActiveState = () => {
  return useQuery({
    queryKey: ['activeState'],
    queryFn: () => apiClient.getActiveState(),
    refetchInterval: 5000, // Refresh every 5 seconds
  });
};

export const useSettings = () => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.getSettings(),
  });
};

export const useHealth = () => {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.getHealth(),
    refetchInterval: 10000, // Refresh every 10 seconds
  });
};
