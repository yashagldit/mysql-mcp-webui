import React, { useState } from 'react';
import { Database, ChevronDown, Check, Loader2 } from 'lucide-react';
import { Card, Badge } from '../Common';
import { useActiveState } from '../../hooks/useActiveState';
import { useDatabases, useActivateDatabase } from '../../hooks/useDatabases';

export const DatabaseQuickSwitch: React.FC = () => {
  const { data: activeState } = useActiveState();
  const { data: databases, isLoading: databasesLoading } = useDatabases(
    activeState?.connectionId || ''
  );
  const activateDatabase = useActivateDatabase();
  const [isOpen, setIsOpen] = useState(false);

  // Don't render if no active connection
  if (!activeState?.connectionId) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-100">
            <Database className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Quick Database Switch</h3>
            <p className="text-sm text-gray-500">No active connection</p>
          </div>
        </div>
      </Card>
    );
  }

  const handleDatabaseSwitch = async (dbName: string) => {
    if (!activeState?.connectionId) return;

    try {
      await activateDatabase.mutateAsync({
        connectionId: activeState.connectionId,
        dbName,
      });
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch database:', error);
    }
  };

  return (
    <Card>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-50">
            <Database className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">Quick Database Switch</h3>
            <p className="text-sm text-gray-500">
              {databases?.length || 0} database(s) available
            </p>
          </div>
        </div>

        {/* Current Database Display / Dropdown Trigger */}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={databasesLoading || !databases || databases.length === 0}
            className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                Current:
              </span>
              <Badge variant="success">
                {activeState.database || 'None'}
              </Badge>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-gray-500 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          {isOpen && databases && databases.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {databases.map((db) => {
                const isActive = db.name === activeState.database;
                const isSwitching =
                  activateDatabase.isPending &&
                  activateDatabase.variables?.dbName === db.name;

                return (
                  <button
                    key={db.name}
                    onClick={() => handleDatabaseSwitch(db.name)}
                    disabled={isActive || isSwitching}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors disabled:opacity-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">
                        {db.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Permission count badge */}
                      {db.permissions && (
                        <Badge size="sm" variant="default">
                          {Object.values(db.permissions).filter(Boolean).length} perms
                        </Badge>
                      )}
                      {/* Active indicator or loading spinner */}
                      {isSwitching ? (
                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                      ) : isActive ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Loading state */}
        {databasesLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading databases...</span>
          </div>
        )}

        {/* Empty state */}
        {!databasesLoading && databases && databases.length === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">No databases found</p>
            <p className="text-xs text-gray-400 mt-1">
              Try discovering databases for this connection
            </p>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </Card>
  );
};
