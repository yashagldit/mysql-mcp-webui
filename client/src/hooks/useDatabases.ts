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
    // Flip the UI immediately so switching feels instant instead of waiting
    // for the 5s activeState poll.
    onMutate: async ({ connectionId, dbName }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['databases', connectionId] }),
        queryClient.cancelQueries({ queryKey: ['databases', 'all'] }),
        queryClient.cancelQueries({ queryKey: ['activeState'] }),
      ]);

      const previousDatabases = queryClient.getQueryData<any[]>(['databases', connectionId]);
      const previousActiveState = queryClient.getQueryData<any>(['activeState']);

      // Optimistically mark the chosen db active+enabled, others inactive
      if (previousDatabases) {
        queryClient.setQueryData<any[]>(['databases', connectionId], (old) =>
          (old || []).map((db) =>
            db.name === dbName
              ? { ...db, isActive: true, isEnabled: true }
              : { ...db, isActive: false }
          )
        );
      }

      if (previousActiveState) {
        const target = previousDatabases?.find((d) => d.name === dbName);
        queryClient.setQueryData(['activeState'], {
          ...previousActiveState,
          connectionId,
          database: dbName,
          alias: target?.alias ?? dbName,
          permissions: target?.permissions ?? previousActiveState.permissions,
        });
      }

      return { previousDatabases, previousActiveState };
    },
    onError: (_err, { connectionId }, context) => {
      // Roll back the optimistic update if the server rejected the switch
      if (context?.previousDatabases) {
        queryClient.setQueryData(['databases', connectionId], context.previousDatabases);
      }
      if (context?.previousActiveState) {
        queryClient.setQueryData(['activeState'], context.previousActiveState);
      }
    },
    onSettled: (_data, _err, { connectionId }) => {
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
