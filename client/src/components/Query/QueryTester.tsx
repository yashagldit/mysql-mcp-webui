import React, { useState } from 'react';
import { Play, Database as DatabaseIcon, AlertCircle } from 'lucide-react';
import { Button, Card, Alert, Badge } from '../Common';
import { SqlEditor } from './SqlEditor';
import { ResultsTable } from './ResultsTable';
import { useExecuteQuery } from '../../hooks/useQuery';
import { useActiveState } from '../../hooks/useActiveState';

export const QueryTester: React.FC = () => {
  const [sql, setSql] = useState('SELECT * FROM users LIMIT 10;');
  const { data: activeState } = useActiveState();
  const executeMutation = useExecuteQuery();

  const handleExecute = async () => {
    if (!sql.trim()) return;

    try {
      await executeMutation.mutateAsync({ sql: sql.trim() });
    } catch (error) {
      console.error('Query execution failed:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  if (!activeState?.database) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Query Tester</h1>
        <Alert type="warning" title="No Active Database">
          Please activate a database first from the Databases page.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Query Tester</h1>
          <div className="flex items-center space-x-2 mt-1">
            <DatabaseIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Connected to:</span>
            <Badge variant="info">{activeState.connectionName}</Badge>
            <span className="text-gray-400">/</span>
            <Badge variant="success">{activeState.database}</Badge>
          </div>
        </div>
        <Button
          icon={<Play className="w-4 h-4" />}
          onClick={handleExecute}
          loading={executeMutation.isPending}
        >
          Execute (Ctrl+Enter)
        </Button>
      </div>

      {/* Permissions Info */}
      {activeState.permissions && (
        <Card padding="sm">
          <div className="flex items-center space-x-2 text-sm">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-gray-600 dark:text-gray-400">Active Permissions:</span>
            <div className="flex gap-1 flex-wrap">
              {Object.entries(activeState.permissions).map(([key, value]) =>
                value ? (
                  <Badge key={key} size="sm" variant="default">
                    {key.toUpperCase()}
                  </Badge>
                ) : null
              )}
            </div>
          </div>
        </Card>
      )}

      {/* SQL Editor */}
      <Card padding="none">
        <div onKeyDown={handleKeyPress}>
          <SqlEditor value={sql} onChange={setSql} />
        </div>
      </Card>

      {/* Error Display */}
      {executeMutation.isError && (
        <Alert type="error" title="Query Error">
          {executeMutation.error instanceof Error
            ? executeMutation.error.message
            : 'Failed to execute query. Please check your SQL syntax and permissions.'}
        </Alert>
      )}

      {/* Results Display */}
      {executeMutation.isSuccess && executeMutation.data && (
        <Card className="overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Results</h3>
            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
              <span>
                <span className="font-medium">{executeMutation.data.rowCount}</span> row
                {executeMutation.data.rowCount !== 1 ? 's' : ''}
              </span>
              <span>
                Executed in <span className="font-medium">{executeMutation.data.executionTime}</span>
              </span>
            </div>
          </div>
          <ResultsTable data={executeMutation.data} />
        </Card>
      )}
    </div>
  );
};
