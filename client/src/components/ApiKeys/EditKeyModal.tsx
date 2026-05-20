import React, { useState, useEffect, useMemo } from 'react';
import { Layers } from 'lucide-react';
import { Modal, Input, Button, Alert, Badge } from '../Common';
import { useUpdateApiKey } from '../../hooks/useApiKeys';
import { useGroups, useApiKeyGroups, useSetApiKeyGroups } from '../../hooks/useGroups';
import type { ApiKey } from '../../types';

interface EditKeyModalProps {
  apiKey: ApiKey;
  isOpen: boolean;
  onClose: () => void;
}

export const EditKeyModal: React.FC<EditKeyModalProps> = ({ apiKey, isOpen, onClose }) => {
  const [name, setName] = useState(apiKey.name);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());

  const updateMutation = useUpdateApiKey();
  const setGroupsMutation = useSetApiKeyGroups();
  const { data: groups } = useGroups();
  const { data: assignedGroups } = useApiKeyGroups(isOpen ? apiKey.id : null);

  useEffect(() => {
    if (isOpen) {
      setName(apiKey.name);
    }
  }, [isOpen, apiKey]);

  useEffect(() => {
    if (isOpen && assignedGroups) {
      setSelectedGroupIds(new Set(assignedGroups.map((g) => g.id)));
    }
  }, [isOpen, assignedGroups]);

  const initialGroupIds = useMemo(
    () => new Set((assignedGroups || []).map((g) => g.id)),
    [assignedGroups]
  );

  const groupsChanged = useMemo(() => {
    if (initialGroupIds.size !== selectedGroupIds.size) return true;
    for (const id of selectedGroupIds) {
      if (!initialGroupIds.has(id)) return true;
    }
    return false;
  }, [initialGroupIds, selectedGroupIds]);

  const handleToggleGroup = (id: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      const tasks: Promise<unknown>[] = [];
      if (trimmed !== apiKey.name) {
        tasks.push(updateMutation.mutateAsync({ id: apiKey.id, request: { name: trimmed } }));
      }
      if (groupsChanged) {
        tasks.push(
          setGroupsMutation.mutateAsync({
            apiKeyId: apiKey.id,
            groupIds: Array.from(selectedGroupIds),
          })
        );
      }
      await Promise.all(tasks);
      onClose();
    } catch (error) {
      console.error('Failed to update API key:', error);
    }
  };

  const isPending = updateMutation.isPending || setGroupsMutation.isPending;
  const hasError = updateMutation.isError || setGroupsMutation.isError;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit API Key" size="md">
      {hasError && (
        <Alert type="error" className="mb-4">
          Failed to update API key. Please try again.
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Key Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter name"
          required
          autoFocus
        />

        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
              <Layers className="w-4 h-4 mr-2" />
              Database Groups
            </div>
            <Badge size="sm">{selectedGroupIds.size} selected</Badge>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Restrict this key to specific groups. With no groups selected, this key can access
            every enabled database (backward-compatible default).
          </p>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-y-auto">
            {!groups || groups.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 p-4 text-center">
                No groups exist yet. Create one from the DB Groups page.
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {groups.map((g) => {
                  const checked = selectedGroupIds.has(g.id);
                  return (
                    <li key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <label className="flex items-center px-3 py-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mr-3 h-4 w-4 text-blue-600 border-gray-300 rounded"
                          checked={checked}
                          onChange={() => handleToggleGroup(g.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {g.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {g.databases.length} database{g.databases.length === 1 ? '' : 's'}
                            {g.description ? ` · ${g.description}` : ''}
                          </p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex space-x-2">
          <Button type="submit" loading={isPending}>
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
};
