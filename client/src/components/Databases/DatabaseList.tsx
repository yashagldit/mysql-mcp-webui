import React from 'react';
import { Alert, Card } from '../Common';
import { DatabaseCard } from './DatabaseCard';
import { useDatabases } from '../../hooks/useDatabases';
import { useConnections } from '../../hooks/useConnections';

export const DatabaseList: React.FC = () => {
  const { data: connections } = useConnections();
  const activeConnection = connections?.find((c) => c.isActive);

  const { data: databases, isLoading, error } = useDatabases(activeConnection?.id || '');

  if (!activeConnection) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Databases</h1>
        <Alert type="warning" title="No Active Connection">
          Please activate a connection first from the Connections page.
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert type="error" title="Error loading databases">
        {error instanceof Error ? error.message : 'Failed to load databases'}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Databases</h1>
        <p className="text-gray-600 mt-1">
          From connection: <span className="font-medium">{activeConnection.name}</span>
        </p>
      </div>

      {databases && databases.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No databases found</p>
            <p className="text-sm text-gray-500">
              Click "Discover" on the connection to find databases
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {databases?.map((database) => (
            <DatabaseCard
              key={database.name}
              database={database}
              connectionId={activeConnection.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};
