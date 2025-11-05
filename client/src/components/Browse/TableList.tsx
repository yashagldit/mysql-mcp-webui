import React, { useState, useMemo } from 'react';
import { Table2, Database as DatabaseIcon, Search } from 'lucide-react';
import { Card, Badge, Spinner } from '../Common';
import { useTables } from '../../hooks/useBrowse';

interface TableListProps {
  selectedTable: string | null;
  onTableSelect: (tableName: string) => void;
}

export const TableList: React.FC<TableListProps> = ({ selectedTable, onTableSelect }) => {
  const { data, isLoading, error } = useTables();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter tables based on search term
  const filteredTables = useMemo(() => {
    if (!data?.tables) return [];
    if (!searchTerm.trim()) return data.tables;

    const lowerSearch = searchTerm.toLowerCase();
    return data.tables.filter(table =>
      table.toLowerCase().includes(lowerSearch)
    );
  }, [data?.tables, searchTerm]);

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
    <Card padding="sm" className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 px-2">
        <Table2 className="w-5 h-5 text-gray-700" />
        <h3 className="font-semibold text-gray-900">Tables</h3>
        <Badge variant="info" size="sm">
          {data.tables.length}
        </Badge>
      </div>

      {/* Search Input */}
      <div className="mb-3 px-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tables..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table List with scrollbar */}
      <div className="overflow-y-auto space-y-1" style={{ maxHeight: 'calc(100vh - 350px)' }}>
        {filteredTables.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            {searchTerm ? 'No tables found' : 'No tables'}
          </div>
        ) : (
          filteredTables.map((tableName) => (
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
          ))
        )}
      </div>

      {/* Show filtered count if searching */}
      {searchTerm && filteredTables.length > 0 && (
        <div className="mt-2 px-2 text-xs text-gray-500">
          Showing {filteredTables.length} of {data.tables.length} tables
        </div>
      )}
    </Card>
  );
};
