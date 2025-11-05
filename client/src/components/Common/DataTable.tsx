import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

type SortDirection = 'asc' | 'desc' | null;

interface DataTableProps {
  columns: string[];
  rows: Record<string, any>[];
  pageSize?: number;
  enableSort?: boolean;
  enablePagination?: boolean;
  emptyMessage?: string;
  className?: string;
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  rows,
  pageSize = 50,
  enableSort = true,
  enablePagination = true,
  emptyMessage = 'No data available',
  className = '',
}) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Handle column sort
  const handleSort = (column: string) => {
    if (!enableSort) return;

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
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Sort the data
  const sortedRows = useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return rows;
    }

    const sorted = [...rows].sort((a, b) => {
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
  }, [rows, sortColumn, sortDirection]);

  // Paginate the data
  const { paginatedRows, totalPages } = useMemo(() => {
    if (!enablePagination) {
      return { paginatedRows: sortedRows, totalPages: 1 };
    }

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const paginated = sortedRows.slice(start, end);
    const total = Math.ceil(sortedRows.length / pageSize);

    return { paginatedRows: paginated, totalPages: total };
  }, [sortedRows, currentPage, pageSize, enablePagination]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(Math.max(1, Math.min(newPage, totalPages)));
  };

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap ${
                    enableSort ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none' : ''
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>{col}</span>
                    {enableSort && sortColumn === col && (
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
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                {columns.map((col) => {
                  const value = row[col];
                  const displayValue = value === null
                    ? 'NULL'
                    : typeof value === 'object'
                    ? JSON.stringify(value)
                    : String(value);

                  const isLongValue = displayValue.length > 100;

                  return (
                    <td
                      key={col}
                      className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 ${isLongValue ? 'max-w-xs' : 'whitespace-nowrap'}`}
                      title={displayValue}
                    >
                      {value === null ? (
                        <span className="text-gray-400 dark:text-gray-500 italic">NULL</span>
                      ) : (
                        <span className={`${isLongValue ? 'block truncate' : ''}`}>
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

      {/* Pagination */}
      {enablePagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, rows.length)} of {rows.length} rows
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              iconPosition="right"
              icon={<ChevronRight className="w-4 h-4" />}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
