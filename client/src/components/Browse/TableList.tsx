import React from 'react';
import { Table2, Database as DatabaseIcon } from 'lucide-react';
import { Card, Badge, Spinner } from '../Common';
import { useTables } from '../../hooks/useBrowse';

interface TableListProps {
  selectedTable: string | null;
  onTableSelect: (tableName: string) => void;
}

export const TableList: React.FC<TableListProps> = ({ selectedTable, onTableSelect }) => {
  const { data, isLoading, error } = useTables();

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="text-red-600 text-sm">
          Error loading tables: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </Card>
    );
  }

  if (!data || data.tables.length === 0) {
    return (
      <Card>
        <div className="text-center py-8 text-gray-500">
          <DatabaseIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No tables found in this database</p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="sm">
      <div className="flex items-center gap-2 mb-3 px-2">
        <Table2 className="w-5 h-5 text-gray-700" />
        <h3 className="font-semibold text-gray-900">Tables</h3>
        <Badge variant="info" size="sm">
          {data.tables.length}
        </Badge>
      </div>
      <div className="space-y-1">
        {data.tables.map((tableName) => (
          <button
            key={tableName}
            onClick={() => onTableSelect(tableName)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              selectedTable === tableName
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <Table2 className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{tableName}</span>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
};
