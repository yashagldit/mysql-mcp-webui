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
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">Database Browser</h1>
        <div className="flex items-center flex-wrap gap-2 mt-2">
          <DatabaseIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Connected to:</span>
          <Badge variant="info">{activeState.connectionName}</Badge>
          <span className="text-gray-400 dark:text-gray-500">/</span>
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
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 md:gap-6">
        {/* Table List Sidebar */}
        <div className="lg:col-span-3">
          <TableList selectedTable={selectedTable} onTableSelect={setSelectedTable} />
        </div>

        {/* Table Browser */}
        <div className="lg:col-span-9">
          {selectedTable ? (
            <TableBrowser tableName={selectedTable} />
          ) : (
            <div className="bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 md:p-12 text-center">
              <DatabaseIcon className="w-12 h-12 md:w-16 md:h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-base md:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Select a Table</h3>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
                Choose a table from the list {window.innerWidth < 1024 ? 'above' : 'on the left'} to browse its data and structure
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
