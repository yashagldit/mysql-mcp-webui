import React, { useState } from 'react';
import { Plus, Layers } from 'lucide-react';
import { Button, Alert, Card } from '../Common';
import { GroupCard } from './GroupCard';
import { GroupEditModal } from './GroupEditModal';
import { useGroups } from '../../hooks/useGroups';

export const GroupList: React.FC = () => {
  const [showCreate, setShowCreate] = useState(false);
  const { data: groups, isLoading, error } = useGroups();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert type="error" title="Error loading groups">
        {error instanceof Error ? error.message : 'Failed to load groups'}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Database Groups</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Bundle databases together and assign them to API keys to scope agent access.
          </p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
          Create Group
        </Button>
      </div>

      <Card>
        <div className="flex items-start space-x-3">
          <Layers className="w-5 h-5 text-indigo-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">How groups work</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Each group contains a set of databases and a permission set (SELECT, INSERT, etc.).
              Assign one or more groups to an API key from the API Keys page. When a key has any
              group assigned, it can <strong>only</strong> see and query databases in those groups,
              and the group's permissions override the per-database permissions. Keys with no
              groups keep full access (backward-compatible default).
            </p>
          </div>
        </div>
      </Card>

      {groups && groups.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Layers className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">No groups yet</p>
            <Button onClick={() => setShowCreate(true)}>Create Your First Group</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups?.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </div>
      )}

      <GroupEditModal group={null} isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
};
