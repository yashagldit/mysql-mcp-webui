import React, { useState } from 'react';
import { Server, Check, Trash2, Edit, Play, RefreshCw } from 'lucide-react';
import { Card, Badge, Button, Alert } from '../Common';
import { EditConnectionModal } from './EditConnectionModal';
import {
  useActivateConnection,
  useDeleteConnection,
  useTestConnection,
  useDiscoverDatabases,
} from '../../hooks/useConnections';
import type { ConnectionWithDetails } from '../../types';

interface ConnectionCardProps {
  connection: ConnectionWithDetails;
}

export const ConnectionCard: React.FC<ConnectionCardProps> = ({ connection }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const activateMutation = useActivateConnection();
  const deleteMutation = useDeleteConnection();
  const testMutation = useTestConnection();
  const discoverMutation = useDiscoverDatabases();

  const handleActivate = async () => {
    try {
      await activateMutation.mutateAsync(connection.id);
    } catch (error) {
      console.error('Failed to activate connection:', error);
    }
  };

  const handleTest = async () => {
    try {
      await testMutation.mutateAsync(connection.id);
    } catch (error) {
      console.error('Failed to test connection:', error);
    }
  };

  const handleDiscover = async () => {
    try {
      await discoverMutation.mutateAsync(connection.id);
    } catch (error) {
      console.error('Failed to discover databases:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(connection.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete connection:', error);
    }
  };

  return (
    <>
      <Card hoverable className="relative">
        {connection.isActive && (
          <div className="absolute top-4 right-4">
            <Badge variant="success" size="sm">
              Active
            </Badge>
          </div>
        )}

        <div className="flex items-start space-x-3 mb-4">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Server className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{connection.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{connection.host}:{connection.port}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">User:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{connection.user}</span>
          </div>
          {connection.databaseCount !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Databases:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{connection.databaseCount}</span>
            </div>
          )}
          {connection.activeDatabase && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Active DB:</span>
              <Badge size="sm">{connection.activeDatabase}</Badge>
            </div>
          )}
        </div>

        {testMutation.isSuccess && testMutation.data && (
          <Alert type="success" className="mb-4">
            Connected successfully! Found {testMutation.data.databases.length} databases
          </Alert>
        )}

        {testMutation.isError && (
          <Alert type="error" className="mb-4">
            Connection failed
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-2">
          {!connection.isActive && (
            <Button
              size="sm"
              variant="primary"
              onClick={handleActivate}
              loading={activateMutation.isPending}
              fullWidth
            >
              <Check className="w-4 h-4 mr-1" />
              Activate
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={handleTest}
            loading={testMutation.isPending}
            fullWidth
          >
            <Play className="w-4 h-4 mr-1" />
            Test
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleDiscover}
            loading={discoverMutation.isPending}
            fullWidth
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Discover
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowEditModal(true)}
            fullWidth
          >
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Button>
          {!connection.isActive && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => setShowDeleteConfirm(true)}
              loading={deleteMutation.isPending}
              fullWidth
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </Card>

      <EditConnectionModal
        connection={connection}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
      />

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete Connection</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete "{connection.name}"? This action cannot be undone.
            </p>
            <div className="flex space-x-2">
              <Button variant="danger" onClick={handleDelete} loading={deleteMutation.isPending}>
                Delete
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
