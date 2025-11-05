import React from 'react';
import { Badge } from '../Common';
import type { RequestLog } from '../../types';
import { formatDate } from '../../lib/utils';

interface LogsTableProps {
  logs: RequestLog[];
  onRowClick: (log: RequestLog) => void;
}

export const LogsTable: React.FC<LogsTableProps> = ({ logs, onRowClick }) => {
  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No request logs available
      </div>
    );
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'info';
    if (status >= 400 && status < 500) return 'warning';
    return 'danger';
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'info';
      case 'POST':
        return 'success';
      case 'PUT':
        return 'warning';
      case 'DELETE':
        return 'danger';
      default:
        return 'default';
    }
  };

  const extractSqlQuery = (requestBody?: string): string | null => {
    if (!requestBody) return null;
    try {
      const parsed = JSON.parse(requestBody);
      return parsed.sql || null;
    } catch {
      return null;
    }
  };

  const truncateQuery = (query: string, maxLength: number = 20): string => {
    if (query.length <= maxLength) return query;
    return query.substring(0, maxLength) + '...';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Timestamp
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Method
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Endpoint
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              SQL Query
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Duration
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {logs.map((log) => {
            const sqlQuery = extractSqlQuery(log.request_body);
            return (
              <tr
                key={log.id}
                onClick={() => onRowClick(log)}
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatDate(log.timestamp)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={getMethodColor(log.method)} size="sm">
                    {log.method}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-mono">
                  {log.endpoint}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 font-mono max-w-xs">
                  {sqlQuery ? (
                    <span className="block truncate" title={sqlQuery}>
                      {truncateQuery(sqlQuery)}
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={getStatusColor(log.status_code)} size="sm">
                    {log.status_code}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {log.duration_ms}ms
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
