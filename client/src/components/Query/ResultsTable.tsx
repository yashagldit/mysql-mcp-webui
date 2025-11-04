import React from 'react';
import type { QueryResult } from '../../types';

interface ResultsTableProps {
  data: QueryResult;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ data }) => {
  if (!data.rows || data.rows.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Query executed successfully but returned no results.
      </div>
    );
  }

  const columns = data.fields || Object.keys(data.rows[0] || {});

  return (
    <div className="overflow-auto w-full max-h-[500px]">
      <table className="divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              {columns.map((column, colIndex) => {
                const value = row[column];
                const displayValue =
                  value === null
                    ? 'NULL'
                    : typeof value === 'object'
                    ? JSON.stringify(value)
                    : String(value);

                const isLongValue = displayValue.length > 50;

                return (
                  <td
                    key={colIndex}
                    className={`px-6 py-4 text-sm text-gray-900 ${isLongValue ? 'max-w-xs' : 'whitespace-nowrap'}`}
                    title={displayValue}
                  >
                    {value === null ? (
                      <span className="text-gray-400 italic">{displayValue}</span>
                    ) : (
                      <span className={`font-mono text-xs ${isLongValue ? 'block truncate' : ''}`}>
                        {displayValue}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
