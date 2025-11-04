import React, { useState, useEffect } from 'react';
import { Modal, Toggle, Button, Alert } from '../Common';
import { useUpdatePermissions } from '../../hooks/useDatabases';
import type { Database, DatabasePermissions } from '../../types';

interface PermissionsModalProps {
  database: Database;
  connectionId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({
  database,
  connectionId,
  isOpen,
  onClose,
}) => {
  const [permissions, setPermissions] = useState<DatabasePermissions>(database.permissions);

  const updateMutation = useUpdatePermissions();

  useEffect(() => {
    if (isOpen) {
      setPermissions(database.permissions);
    }
  }, [isOpen, database]);

  const handleToggle = (key: keyof DatabasePermissions, value: boolean) => {
    setPermissions((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        connectionId,
        dbName: database.name,
        permissions: { permissions: permissions },
      });
      onClose();
    } catch (error) {
      console.error('Failed to update permissions:', error);
    }
  };

  const permissionGroups = [
    {
      title: 'Read Operations',
      description: 'Query and view data',
      permissions: [
        { key: 'select' as const, label: 'SELECT', description: 'Read data from tables' },
      ],
    },
    {
      title: 'Write Operations',
      description: 'Modify data in tables',
      permissions: [
        { key: 'insert' as const, label: 'INSERT', description: 'Add new records' },
        { key: 'update' as const, label: 'UPDATE', description: 'Modify existing records' },
        { key: 'delete' as const, label: 'DELETE', description: 'Remove records' },
        { key: 'truncate' as const, label: 'TRUNCATE', description: 'Remove all records' },
      ],
    },
    {
      title: 'Schema Operations',
      description: 'Modify database structure',
      permissions: [
        { key: 'create' as const, label: 'CREATE', description: 'Create tables/indexes' },
        { key: 'alter' as const, label: 'ALTER', description: 'Modify table structure' },
        { key: 'drop' as const, label: 'DROP', description: 'Delete tables/indexes' },
      ],
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Permissions: ${database.name}`}
      size="lg"
    >
      {updateMutation.isError && (
        <Alert type="error" className="mb-4">
          Failed to update permissions. Please try again.
        </Alert>
      )}

      <div className="space-y-6">
        {permissionGroups.map((group) => (
          <div key={group.title} className="border-b border-gray-200 pb-4 last:border-0">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{group.title}</h3>
            <p className="text-xs text-gray-500 mb-3">{group.description}</p>
            <div className="space-y-3">
              {group.permissions.map((perm) => (
                <div key={perm.key} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{perm.label}</p>
                    <p className="text-xs text-gray-500">{perm.description}</p>
                  </div>
                  <Toggle
                    checked={permissions[perm.key]}
                    onChange={(value) => handleToggle(perm.key, value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex space-x-2 pt-6 border-t border-gray-200 mt-6">
        <Button onClick={handleSave} loading={updateMutation.isPending}>
          Save Permissions
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
};
