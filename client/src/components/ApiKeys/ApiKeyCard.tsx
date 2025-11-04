import React, { useState } from 'react';
import { Key, Trash2, Edit, FileText } from 'lucide-react';
import { Card, Badge, Button } from '../Common';
import { EditKeyModal } from './EditKeyModal';
import { useRevokeApiKey } from '../../hooks/useApiKeys';
import type { ApiKey } from '../../types';
import { formatDate, formatRelativeTime } from '../../lib/utils';

interface ApiKeyCardProps {
  apiKey: ApiKey;
}

export const ApiKeyCard: React.FC<ApiKeyCardProps> = ({ apiKey }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const revokeMutation = useRevokeApiKey();

  const handleRevoke = async () => {
    try {
      await revokeMutation.mutateAsync(apiKey.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to revoke API key:', error);
    }
  };

  return (
    <>
      <Card hoverable>
        <div className="flex items-start space-x-3 mb-4">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Key className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{apiKey.name}</h3>
            <p className="text-xs text-gray-500 font-mono mt-1">{apiKey.keyPreview}</p>
          </div>
          {apiKey.isActive && (
            <Badge variant="success" size="sm">
              Active
            </Badge>
          )}
        </div>

        <div className="space-y-2 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-gray-600">Created:</span>
            <span className="text-gray-900">{formatDate(apiKey.created_at)}</span>
          </div>
          {apiKey.last_used_at && (
            <div className="flex justify-between">
              <span className="text-gray-600">Last Used:</span>
              <span className="text-gray-900">{formatRelativeTime(apiKey.last_used_at)}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowEditModal(true)}
            fullWidth
          >
            <Edit className="w-4 h-4 mr-1" />
            Rename
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {}}
            fullWidth
          >
            <FileText className="w-4 h-4 mr-1" />
            Logs
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => setShowDeleteConfirm(true)}
            loading={revokeMutation.isPending}
            fullWidth
            className="col-span-2"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Revoke Key
          </Button>
        </div>
      </Card>

      <EditKeyModal
        apiKey={apiKey}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
      />

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Revoke API Key</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to revoke "{apiKey.name}"? This will immediately invalidate the
              key and cannot be undone.
            </p>
            <div className="flex space-x-2">
              <Button variant="danger" onClick={handleRevoke} loading={revokeMutation.isPending}>
                Revoke
              </Button>
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
};
