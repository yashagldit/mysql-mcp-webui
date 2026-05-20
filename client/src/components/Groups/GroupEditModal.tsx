import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Input, Button, Alert, Toggle, Badge } from '../Common';
import { useCreateGroup, useUpdateGroup } from '../../hooks/useGroups';
import { useAllDatabases } from '../../hooks/useDatabases';
import type { DatabaseGroup, DatabasePermissions } from '../../types';

interface GroupEditModalProps {
  group: DatabaseGroup | null; // null = creating new
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_PERMS: DatabasePermissions = {
  select: true,
  insert: false,
  update: false,
  delete: false,
  create: false,
  alter: false,
  drop: false,
  truncate: false,
};

const PERMISSION_GROUPS = [
  {
    title: 'Read',
    perms: [{ key: 'select' as const, label: 'SELECT' }],
  },
  {
    title: 'Write',
    perms: [
      { key: 'insert' as const, label: 'INSERT' },
      { key: 'update' as const, label: 'UPDATE' },
      { key: 'delete' as const, label: 'DELETE' },
      { key: 'truncate' as const, label: 'TRUNCATE' },
    ],
  },
  {
    title: 'Schema',
    perms: [
      { key: 'create' as const, label: 'CREATE' },
      { key: 'alter' as const, label: 'ALTER' },
      { key: 'drop' as const, label: 'DROP' },
    ],
  },
];

export const GroupEditModal: React.FC<GroupEditModalProps> = ({ group, isOpen, onClose }) => {
  const isEdit = !!group;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<DatabasePermissions>(DEFAULT_PERMS);
  const [selectedDbIds, setSelectedDbIds] = useState<Set<string>>(new Set());
  const [dbFilter, setDbFilter] = useState('');

  const { data: allDatabases } = useAllDatabases();
  const createMutation = useCreateGroup();
  const updateMutation = useUpdateGroup();
  const mutation = isEdit ? updateMutation : createMutation;

  useEffect(() => {
    if (!isOpen) return;
    if (group) {
      setName(group.name);
      setDescription(group.description ?? '');
      setPermissions(group.permissions);
      setSelectedDbIds(new Set(group.databaseIds));
    } else {
      setName('');
      setDescription('');
      setPermissions(DEFAULT_PERMS);
      setSelectedDbIds(new Set());
    }
    setDbFilter('');
  }, [isOpen, group]);

  const databases = useMemo(() => allDatabases || [], [allDatabases]);

  const filteredDatabases = useMemo(() => {
    const q = dbFilter.trim().toLowerCase();
    if (!q) return databases;
    return databases.filter(
      (d) =>
        d.database.toLowerCase().includes(q) ||
        d.alias.toLowerCase().includes(q) ||
        d.connectionName.toLowerCase().includes(q)
    );
  }, [databases, dbFilter]);

  const handleTogglePerm = (key: keyof DatabasePermissions, value: boolean) => {
    setPermissions((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggleDb = (dbId: string) => {
    setSelectedDbIds((prev) => {
      const next = new Set(prev);
      if (next.has(dbId)) next.delete(dbId);
      else next.add(dbId);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (isEdit && group) {
        await updateMutation.mutateAsync({
          id: group.id,
          request: {
            name: name.trim(),
            description: description.trim() || null,
            permissions,
            databaseIds: Array.from(selectedDbIds),
          },
        });
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          description: description.trim() || null,
          permissions,
          databaseIds: Array.from(selectedDbIds),
        });
      }
      onClose();
    } catch (err) {
      console.error('Failed to save group:', err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `Edit Group: ${group?.name}` : 'Create New Group'} size="xl">
      {mutation.isError && (
        <Alert type="error" className="mb-4">
          {(mutation.error as any)?.response?.data?.error || 'Failed to save group. Please try again.'}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Group Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Analytics Read-Only"
            required
            autoFocus
          />
          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Permissions</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            These permissions apply to every database in this group, overriding the per-database
            permissions for API keys assigned to this group.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            {PERMISSION_GROUPS.map((g) => (
              <div key={g.title}>
                <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
                  {g.title}
                </h4>
                <div className="space-y-2">
                  {g.perms.map((p) => (
                    <div key={p.key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{p.label}</span>
                      <Toggle
                        size="sm"
                        checked={permissions[p.key]}
                        onChange={(v) => handleTogglePerm(p.key, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Databases</h3>
            <Badge size="sm">{selectedDbIds.size} selected</Badge>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Pick the databases this group grants access to. API keys assigned to this group will
            only see and query these databases.
          </p>
          <Input
            value={dbFilter}
            onChange={(e) => setDbFilter(e.target.value)}
            placeholder="Filter by name, alias, or connection..."
          />
          <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg max-h-72 overflow-y-auto">
            {filteredDatabases.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 p-4 text-center">
                No databases match.
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredDatabases.map((db) => {
                  const checked = selectedDbIds.has(db.id);
                  return (
                    <li key={db.id} className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <label className="flex items-center w-full cursor-pointer">
                        <input
                          type="checkbox"
                          className="mr-3 h-4 w-4 text-blue-600 border-gray-300 rounded"
                          checked={checked}
                          onChange={() => handleToggleDb(db.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {db.alias}
                            <span className="text-gray-400 dark:text-gray-500 font-normal ml-2">
                              ({db.database})
                            </span>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {db.connectionName}
                          </p>
                        </div>
                        {!db.isEnabled && (
                          <Badge size="sm" variant="warning">disabled</Badge>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex space-x-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button type="submit" loading={mutation.isPending}>
            {isEdit ? 'Save Changes' : 'Create Group'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
};
