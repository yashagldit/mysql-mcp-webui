import React, { useState } from 'react';
import { Database as DatabaseIcon } from 'lucide-react';
import { TableList, TableBrowser } from '../components/Browse';
import { Alert, Badge, DatabaseSwitcher } from '../components/Common';
import { useActiveState } from '../hooks/useActiveState';

export const BrowserPage: React.FC = () => {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const { data: activeState } = useActiveState();

  if (!activeState?.database) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Database Browser</h1>
        <Alert type="warning" title="No Active Database">
          Please activate a database first from the Databases page.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Database Browser</h1>
        <div className="flex items-center space-x-2 mt-2">
          <DatabaseIcon className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">Connected to:</span>
          <Badge variant="info">{activeState.connectionName}</Badge>
          <span className="text-gray-400">/</span>
          <DatabaseSwitcher />
        </div>
      </div>

      {/* Permissions Info */}
      {activeState.permissions && (
        <Alert type="info" title="Active Permissions">
          <div className="flex gap-2 flex-wrap mt-2">
            {Object.entries(activeState.permissions).map(([key, value]) =>
              value ? (
                <Badge key={key} size="sm" variant="default">
                  {key.toUpperCase()}
                </Badge>
              ) : null
            )}
          </div>
        </Alert>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Table List Sidebar */}
        <div className="col-span-3">
          <TableList selectedTable={selectedTable} onTableSelect={setSelectedTable} />
        </div>

        {/* Table Browser */}
        <div className="col-span-9">
          {selectedTable ? (
            <TableBrowser tableName={selectedTable} />
          ) : (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <DatabaseIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Table</h3>
              <p className="text-gray-600">
                Choose a table from the list on the left to browse its data and structure
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
