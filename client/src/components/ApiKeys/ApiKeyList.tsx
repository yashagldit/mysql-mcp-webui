import React, { useState } from 'react';
import { Plus, Key } from 'lucide-react';
import { Button, Alert, Card } from '../Common';
import { ApiKeyCard } from './ApiKeyCard';
import { CreateKeyModal } from './CreateKeyModal';
import { useApiKeys } from '../../hooks/useApiKeys';

export const ApiKeyList: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { data: apiKeys, isLoading, error } = useApiKeys();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert type="error" title="Error loading API keys">
        {error instanceof Error ? error.message : 'Failed to load API keys'}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-gray-600 mt-1">Manage authentication keys for API access</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
          Create New Key
        </Button>
      </div>

      <Card>
        <div className="flex items-start space-x-3 mb-4">
          <Key className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">About API Keys</h3>
            <p className="text-sm text-gray-600 mt-1">
              API keys are used to authenticate requests to the MySQL MCP server. Each key can be
              named for easy identification and tracking. Keep your keys secure and never share them
              publicly.
            </p>
          </div>
        </div>
      </Card>

      {apiKeys && apiKeys.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No API keys configured yet</p>
            <Button onClick={() => setShowCreateModal(true)}>Create Your First API Key</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apiKeys?.map((apiKey) => (
            <ApiKeyCard key={apiKey.id} apiKey={apiKey} />
          ))}
        </div>
      )}

      <CreateKeyModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  );
};
