import React, { useState, useMemo } from 'react';
import { Table2, Database as DatabaseIcon, Info, Key, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Play } from 'lucide-react';
import { Card, Badge, Button, Spinner, Alert, DataTable } from '../Common';
import { useTableStructure, useTableData, useTableInfo } from '../../hooks/useBrowse';
import { useExecuteQuery } from '../../hooks/useQuery';

interface TableBrowserProps {
  tableName: string;
}

type TabType = 'data' | 'structure' | 'info' | 'query';
type SortDirection = 'asc' | 'desc' | null;

export const TableBrowser: React.FC<TableBrowserProps> = ({ tableName }) => {
  const [activeTab, setActiveTab] = useState<TabType>('data');
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [querySql, setQuerySql] = useState(`SELECT * FROM \`${tableName}\` LIMIT 10`);
  const pageSize = 50;

  const { data: structureData, isLoading: structureLoading } = useTableStructure(tableName);
  const { data: tableData, isLoading: dataLoading } = useTableData(tableName, page, pageSize);
  const { data: infoData, isLoading: infoLoading } = useTableInfo(tableName);
  const executeMutation = useExecuteQuery();

  // Validate query is SELECT only
  const isReadOnlyQuery = (sql: string): { valid: boolean; error?: string } => {
    const trimmed = sql.trim().toUpperCase();

    // Check if query starts with SELECT or WITH (for CTEs)
    if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
      return {
        valid: false,
        error: 'Only SELECT queries are allowed in the browser. Use the Query Tester for other operations.'
      };
    }

    // Check for forbidden keywords
    const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE'];
    for (const keyword of forbidden) {
      if (trimmed.includes(keyword)) {
        return {
          valid: false,
          error: `${keyword} operations are not allowed in the browser. Use the Query Tester for write operations.`
        };
      }
    }

    return { valid: true };
  };

  // Handle query execution
  const handleExecuteQuery = async () => {
    const validation = isReadOnlyQuery(querySql);
    if (!validation.valid) {
      return; // Error will be shown in UI
    }

    try {
      await executeMutation.mutateAsync({ sql: querySql.trim() });
    } catch (error) {
      console.error('Query execution failed:', error);
    }
  };

  // Handle column sort
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort the table data
  const sortedRows = useMemo(() => {
    if (!tableData?.rows || !sortColumn || !sortDirection) {
      return tableData?.rows || [];
    }

    const sorted = [...tableData.rows].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      // Handle null values
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal === null) return sortDirection === 'asc' ? -1 : 1;

      // Handle numbers
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // Handle strings
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (sortDirection === 'asc') {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return bStr < aStr ? -1 : bStr > aStr ? 1 : 0;
      }
    });

    return sorted;
  }, [tableData?.rows, sortColumn, sortDirection]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Table2 className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">{tableName}</h2>
              {infoData && infoData.table_rows !== undefined && infoData.data_length !== undefined && (
                <p className="text-sm text-gray-600 mt-1">
                  {infoData.table_rows.toLocaleString()} rows • {formatBytes(infoData.data_length)} data • {infoData.engine} engine
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Card padding="none">
        <div className="border-b border-gray-200">
          <div className="flex space-x-1 px-4">
            {[
              { id: 'data', label: 'Browse Data', icon: DatabaseIcon },
              { id: 'structure', label: 'Structure', icon: Table2 },
              { id: 'query', label: 'Query', icon: Play },
              { id: 'info', label: 'Info', icon: Info },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {/* Data Tab */}
          {activeTab === 'data' && (
            <>
              {dataLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : tableData && tableData.rows.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {tableData.columns.map((col) => (
                            <th
                              key={col}
                              onClick={() => handleSort(col)}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
                            >
                              <div className="flex items-center gap-1">
                                <span>{col}</span>
                                {sortColumn === col && (
                                  sortDirection === 'asc' ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sortedRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            {tableData.columns.map((col) => (
                              <td key={col} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                {row[col] === null ? (
                                  <span className="text-gray-400 italic">NULL</span>
                                ) : (
                                  String(row[col])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {tableData.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, tableData.pagination.total)} of {tableData.pagination.total} rows
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          icon={<ChevronLeft className="w-4 h-4" />}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-gray-600">
                          Page {page} of {tableData.pagination.totalPages}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPage(p => Math.min(tableData.pagination.totalPages, p + 1))}
                          disabled={page === tableData.pagination.totalPages}
                          iconPosition="right"
                          icon={<ChevronRight className="w-4 h-4" />}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <DatabaseIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No data found in this table</p>
                </div>
              )}
            </>
          )}

          {/* Structure Tab */}
          {activeTab === 'structure' && (
            <>
              {structureLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : structureData ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Field
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Null
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Key
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Default
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Extra
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {structureData.columns.map((col, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              {col.Key === 'PRI' && <Key className="w-4 h-4 text-yellow-500" />}
                              {col.Field}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <code className="bg-gray-100 px-2 py-1 rounded text-xs">{col.Type}</code>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{col.Null}</td>
                          <td className="px-4 py-3 text-sm">
                            {col.Key && <Badge variant={col.Key === 'PRI' ? 'warning' : 'default'} size="sm">{col.Key}</Badge>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {col.Default === null ? <span className="text-gray-400 italic">NULL</span> : col.Default}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{col.Extra}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          )}

          {/* Query Tab */}
          {activeTab === 'query' && (
            <>
              <div className="space-y-4">
                {/* Query validation warning */}
                <Alert type="info" title="Read-Only Queries">
                  Only SELECT queries are allowed in this browser. For INSERT, UPDATE, DELETE, or DDL operations, please use the Query Tester page.
                </Alert>

                {/* SQL Editor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">SQL Query</label>
                  <textarea
                    value={querySql}
                    onChange={(e) => setQuerySql(e.target.value)}
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="SELECT * FROM tablename"
                  />
                </div>

                {/* Execute Button */}
                <div className="flex items-center gap-2">
                  <Button
                    icon={<Play className="w-4 h-4" />}
                    onClick={handleExecuteQuery}
                    loading={executeMutation.isPending}
                    disabled={!isReadOnlyQuery(querySql).valid}
                  >
                    Execute Query (SELECT only)
                  </Button>
                </div>

                {/* Validation Error */}
                {!isReadOnlyQuery(querySql).valid && (
                  <Alert type="error" title="Invalid Query">
                    {isReadOnlyQuery(querySql).error}
                  </Alert>
                )}

                {/* Query Error */}
                {executeMutation.isError && (
                  <Alert type="error" title="Query Error">
                    {executeMutation.error instanceof Error
                      ? executeMutation.error.message
                      : 'Failed to execute query'}
                  </Alert>
                )}

                {/* Query Results */}
                {executeMutation.isSuccess && executeMutation.data && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Results</h3>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">{executeMutation.data.rowCount}</span> row
                        {executeMutation.data.rowCount !== 1 ? 's' : ''} •{' '}
                        <span className="font-medium">{executeMutation.data.executionTime}</span>
                      </div>
                    </div>

                    <DataTable
                      columns={executeMutation.data.fields}
                      rows={executeMutation.data.rows}
                      pageSize={50}
                      enableSort={true}
                      enablePagination={true}
                      emptyMessage="Query executed successfully but returned no rows"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Info Tab */}
          {activeTab === 'info' && (
            <>
              {infoLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : infoData ? (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">General Information</h3>
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-xs text-gray-600">Table Name</dt>
                        <dd className="text-sm font-medium text-gray-900">{infoData.table_name}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-600">Engine</dt>
                        <dd className="text-sm font-medium text-gray-900">{infoData.engine}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-600">Collation</dt>
                        <dd className="text-sm font-medium text-gray-900">{infoData.table_collation}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-600">Comment</dt>
                        <dd className="text-sm text-gray-900">{infoData.table_comment || 'None'}</dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Statistics</h3>
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-xs text-gray-600">Rows</dt>
                        <dd className="text-sm font-medium text-gray-900">{infoData.table_rows?.toLocaleString() || '0'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-600">Avg Row Length</dt>
                        <dd className="text-sm font-medium text-gray-900">{formatBytes(infoData.avg_row_length || 0)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-600">Data Size</dt>
                        <dd className="text-sm font-medium text-gray-900">{formatBytes(infoData.data_length || 0)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-600">Index Size</dt>
                        <dd className="text-sm font-medium text-gray-900">{formatBytes(infoData.index_length || 0)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-600">Total Size</dt>
                        <dd className="text-sm font-medium text-gray-900">{formatBytes((infoData.data_length || 0) + (infoData.index_length || 0))}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-600">Auto Increment</dt>
                        <dd className="text-sm font-medium text-gray-900">{infoData.auto_increment?.toLocaleString() || 'N/A'}</dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Timestamps</h3>
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-xs text-gray-600">Created</dt>
                        <dd className="text-sm text-gray-900">{formatDate(infoData.create_time)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-600">Last Updated</dt>
                        <dd className="text-sm text-gray-900">{formatDate(infoData.update_time)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </Card>
    </div>
  );
};
