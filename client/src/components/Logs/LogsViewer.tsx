import React, { useState, useEffect } from 'react';
import { RefreshCw, Trash2, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button, Alert, Card, Input, Pagination } from '../Common';
import { LogsTable } from './LogsTable';
import { UsageStats } from './UsageStats';
import { LogDetailsModal } from './LogDetailsModal';
import { useLogs, useClearLogs } from '../../hooks/useLogs';
import { useDebounce } from '../../hooks/useDebounce';
import { useApiKeys } from '../../hooks/useApiKeys';

export const LogsViewer: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApiKeyId, setSelectedApiKeyId] = useState<string>('');
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load API keys for the filter dropdown
  const { data: apiKeys } = useApiKeys();

  // Initialize selectedApiKeyId from URL query parameter
  useEffect(() => {
    const apiKeyIdParam = searchParams.get('apiKeyId');
    if (apiKeyIdParam) {
      setSelectedApiKeyId(apiKeyIdParam);
    }
  }, [searchParams]);

  // Debounce search query to avoid refetching on every keystroke
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const offset = (currentPage - 1) * pageSize;
  const { data: logsData, isLoading, isFetching, error, refetch } = useLogs({
    limit: pageSize,
    offset,
    search: debouncedSearchQuery || undefined,
    apiKeyId: selectedApiKeyId || undefined
  });
  const clearMutation = useClearLogs();

  const handleClear = async () => {
    try {
      await clearMutation.mutateAsync(30);
      setShowClearConfirm(false);
      refetch();
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleApiKeyFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newApiKeyId = e.target.value;
    setSelectedApiKeyId(newApiKeyId);
    setCurrentPage(1); // Reset to first page when changing filter

    // Update URL query parameter
    if (newApiKeyId) {
      setSearchParams({ apiKeyId: newApiKeyId });
    } else {
      setSearchParams({});
    }
  };

  const totalItems = logsData?.pagination.total || 0;

  // Only show full loading on initial load (when there's no data yet)
  if (isLoading && !logsData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error && !logsData) {
    return (
      <Alert type="error" title="Error loading logs">
        {error instanceof Error ? error.message : 'Failed to load request logs'}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Request Logs</h1>
          <p className="text-gray-600 mt-1">
            View and analyze API request history
            {isFetching && <span className="ml-2 text-sm text-blue-600">(Updating...)</span>}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="secondary"
            icon={<RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Button
            variant="danger"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={() => setShowClearConfirm(true)}
          >
            Clear Old Logs
          </Button>
        </div>
      </div>

      {/* Usage Statistics */}
      <UsageStats />

      {/* Search and Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 max-w-md">
          <Input
            type="text"
            placeholder="Search by endpoint, method, or query..."
            value={searchQuery}
            onChange={handleSearchChange}
            icon={<Search className="w-4 h-4 text-gray-400" />}
          />
        </div>
        <div className="w-64">
          <select
            value={selectedApiKeyId}
            onChange={handleApiKeyFilterChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All API Keys</option>
            {apiKeys?.map((key) => (
              <option key={key.id} value={key.id}>
                {key.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <Card padding="none">
        <LogsTable
          logs={logsData?.logs || []}
          onRowClick={(log) => setSelectedLogId(log.id)}
        />
        {/* Pagination */}
        {totalItems > 0 && (
          <Pagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </Card>

      {/* Log Details Modal */}
      {selectedLogId && (
        <LogDetailsModal
          logId={selectedLogId}
          isOpen={!!selectedLogId}
          onClose={() => setSelectedLogId(null)}
        />
      )}

      {/* Clear Confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Clear Old Logs</h3>
            <p className="text-gray-600 mb-4">
              This will delete all logs older than 30 days. This action cannot be undone.
            </p>
            <div className="flex space-x-2">
              <Button variant="danger" onClick={handleClear} loading={clearMutation.isPending}>
                Clear Logs
              </Button>
              <Button variant="secondary" onClick={() => setShowClearConfirm(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
