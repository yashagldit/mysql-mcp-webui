import React, { useState } from 'react';
import { Table2, Database as DatabaseIcon, Info, Key, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, Badge, Button, Spinner } from '../Common';
import { useTableStructure, useTableData, useTableInfo } from '../../hooks/useBrowse';

interface TableBrowserProps {
  tableName: string;
}

type TabType = 'data' | 'structure' | 'info';

export const TableBrowser: React.FC<TableBrowserProps> = ({ tableName }) => {
  const [activeTab, setActiveTab] = useState<TabType>('data');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: structureData, isLoading: structureLoading } = useTableStructure(tableName);
  const { data: tableData, isLoading: dataLoading } = useTableData(tableName, page, pageSize);
  const { data: infoData, isLoading: infoLoading } = useTableInfo(tableName);

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
              {infoData && (
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
                              className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tableData.rows.map((row, idx) => (
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
                        <dd className="text-sm font-medium text-gray-900">{infoData.table_rows.toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-600">Avg Row Length</dt>
                        <dd className="text-sm font-medium text-gray-900">{formatBytes(infoData.avg_row_length)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-600">Data Size</dt>
                        <dd className="text-sm font-medium text-gray-900">{formatBytes(infoData.data_length)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-600">Index Size</dt>
                        <dd className="text-sm font-medium text-gray-900">{formatBytes(infoData.index_length)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-600">Total Size</dt>
                        <dd className="text-sm font-medium text-gray-900">{formatBytes(infoData.data_length + infoData.index_length)}</dd>
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
