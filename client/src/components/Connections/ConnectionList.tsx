import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Alert } from '../Common';
import { ConnectionCard } from './ConnectionCard';
import { AddConnectionModal } from './AddConnectionModal';
import { useConnections } from '../../hooks/useConnections';

export const ConnectionList: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const { data: connections, isLoading, error } = useConnections();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert type="error" title="Error loading connections">
        {error instanceof Error ? error.message : 'Failed to load connections'}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">MySQL Connections</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your MySQL server connections</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddModal(true)}>
          Add Connection
        </Button>
      </div>

      {connections && connections.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No connections configured yet</p>
          <Button onClick={() => setShowAddModal(true)}>Add Your First Connection</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connections?.map((connection) => (
            <ConnectionCard key={connection.id} connection={connection} />
          ))}
        </div>
      )}

      <AddConnectionModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
};
