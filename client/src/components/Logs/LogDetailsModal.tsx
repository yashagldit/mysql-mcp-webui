import React from 'react';
import { Modal, Badge, CodeBlock, Alert } from '../Common';
import { formatDate } from '../../lib/utils';
import { useLogDetails } from '../../hooks/useLogs';

interface LogDetailsModalProps {
  logId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LogDetailsModal: React.FC<LogDetailsModalProps> = ({ logId, isOpen, onClose }) => {
  const { data: log, isLoading, error } = useLogDetails(logId);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'info';
    if (status >= 400 && status < 500) return 'warning';
    return 'danger';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Details" size="xl">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}

        {error && (
          <Alert type="error" title="Error loading log details">
            {error instanceof Error ? error.message : 'Failed to load log details'}
          </Alert>
        )}

        {log && (
          <>
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Timestamp</label>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{formatDate(log.timestamp)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Duration</label>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{log.duration_ms}ms</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Method</label>
                <div className="mt-1">
                  <Badge variant="info" size="sm">
                    {log.method}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Status Code</label>
                <div className="mt-1">
                  <Badge variant={getStatusColor(log.status_code)} size="sm">
                    {log.status_code}
                  </Badge>
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Endpoint</label>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 font-mono">{log.endpoint}</p>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">API Key ID</label>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 font-mono">{log.api_key_id}</p>
              </div>
            </div>

            {/* Request Body */}
            {log.request_body && (
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">Request Body</label>
                <CodeBlock
                  code={JSON.stringify(JSON.parse(log.request_body), null, 2)}
                  language="json"
                  maxHeight="300px"
                />
              </div>
            )}

            {/* Response Body */}
            {log.response_body && (() => {
              try {
                const parsed = JSON.parse(log.response_body);

                // Check if this is an MCP response with content
                if (parsed.content && Array.isArray(parsed.content) && parsed.content.length > 0) {
                  const textContent = parsed.content.find((c: any) => c.type === 'text');

                  if (textContent && textContent.text) {
                    return (
                      <>
                        <div className="mb-4">
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">Response Content</label>
                          <CodeBlock
                            code={textContent.text}
                            language="text"
                            maxHeight="400px"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">Full Response Body</label>
                          <CodeBlock
                            code={JSON.stringify(parsed, null, 2)}
                            language="json"
                            maxHeight="300px"
                          />
                        </div>
                      </>
                    );
                  }
                }

                // Default: show as JSON
                return (
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">Response Body</label>
                    <CodeBlock
                      code={JSON.stringify(parsed, null, 2)}
                      language="json"
                      maxHeight="300px"
                    />
                  </div>
                );
              } catch (e) {
                // If parsing fails, show raw
                return (
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">Response Body</label>
                    <CodeBlock
                      code={log.response_body}
                      language="text"
                      maxHeight="300px"
                    />
                  </div>
                );
              }
            })()}
          </>
        )}
      </div>
    </Modal>
  );
};
