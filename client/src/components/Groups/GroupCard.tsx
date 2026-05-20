import React, { useState } from 'react';
import { Layers, Edit, Trash2, Database, Key } from 'lucide-react';
import { Card, Badge, Button } from '../Common';
import { GroupEditModal } from './GroupEditModal';
import { useDeleteGroup } from '../../hooks/useGroups';
import type { DatabaseGroup, DatabasePermissions } from '../../types';

interface GroupCardProps {
  group: DatabaseGroup;
}

const PERM_KEYS: Array<keyof DatabasePermissions> = [
  'select',
  'insert',
  'update',
  'delete',
  'create',
  'alter',
  'drop',
  'truncate',
];

export const GroupCard: React.FC<GroupCardProps> = ({ group }) => {
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteMutation = useDeleteGroup();

  const allowedPerms = PERM_KEYS.filter((k) => group.permissions[k]);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(group.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
  };

  return (
    <>
      <Card hoverable>
        <div className="flex items-start space-x-3 mb-4">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
            <Layers className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{group.name}</h3>
            {group.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                {group.description}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center text-sm">
            <Database className="w-4 h-4 text-gray-400 mr-2" />
            <span className="text-gray-600 dark:text-gray-400">
              {group.databases.length} database{group.databases.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex items-center text-sm">
            <Key className="w-4 h-4 text-gray-400 mr-2" />
            <span className="text-gray-600 dark:text-gray-400">
              {group.apiKeyCount} API key{group.apiKeyCount === 1 ? '' : 's'} assigned
            </span>
          </div>

          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Permissions</p>
            <div className="flex flex-wrap gap-1">
              {allowedPerms.length === 0 ? (
                <Badge size="sm" variant="danger">no permissions</Badge>
              ) : (
                allowedPerms.map((p) => (
                  <Badge key={p} size="sm" variant="info">
                    {p.toUpperCase()}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowEdit(true)} fullWidth>
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Button>
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
        </div>
      </Card>

      <GroupEditModal group={group} isOpen={showEdit} onClose={() => setShowEdit(false)} />

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Delete Group
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Delete "{group.name}"? Any API keys assigned to this group will lose access to its
              databases. This cannot be undone.
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
