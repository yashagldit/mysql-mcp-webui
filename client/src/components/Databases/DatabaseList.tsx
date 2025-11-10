import React, { useMemo } from 'react';
import { Alert, Card, Badge } from '../Common';
import { DatabaseCard } from './DatabaseCard';
import { useAllDatabases } from '../../hooks/useDatabases';

export const DatabaseList: React.FC = () => {
  const { data: allDatabases, isLoading, error } = useAllDatabases();

  // Group databases by connection
  const groupedDatabases = useMemo(() => {
    if (!allDatabases) return {};

    return allDatabases.reduce((acc, db) => {
      if (!acc[db.connectionId]) {
        acc[db.connectionId] = {
          connectionName: db.connectionName,
          databases: [],
        };
      }
      acc[db.connectionId].databases.push(db);
      return acc;
    }, {} as Record<string, { connectionName: string; databases: typeof allDatabases }>);
  }, [allDatabases]);

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

  if (!allDatabases || allDatabases.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Databases</h1>
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-4">No databases found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Add a connection and click "Discover" to find databases
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">All Databases</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Showing databases from all connections ({allDatabases.length} total)
        </p>
      </div>

      {Object.entries(groupedDatabases).map(([connectionId, { connectionName, databases }]) => (
        <div key={connectionId} className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {connectionName}
            </h2>
            <Badge size="sm">{databases.length} database{databases.length !== 1 ? 's' : ''}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {databases.map((db) => (
              <DatabaseCard
                key={db.alias}
                database={{
                  name: db.database,
                  alias: db.alias,
                  permissions: db.permissions,
                  isEnabled: db.isEnabled,
                  isActive: db.isActive,
                }}
                connectionId={connectionId}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
