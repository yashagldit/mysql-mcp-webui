import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../Common';
import { useUpdateAlias } from '../../hooks/useDatabases';
import type { Database } from '../../types';

interface EditAliasModalProps {
  database: Database;
  connectionId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const EditAliasModal: React.FC<EditAliasModalProps> = ({
  database,
  connectionId,
  isOpen,
  onClose,
}) => {
  const [alias, setAlias] = useState(database.alias);
  const [error, setError] = useState<string | null>(null);
  const updateAliasMutation = useUpdateAlias();

  // Reset alias when modal opens with new database
  useEffect(() => {
    if (isOpen) {
      setAlias(database.alias);
      setError(null);
    }
  }, [isOpen, database.alias]);

  const validateAlias = (value: string): boolean => {
    if (!value) {
      setError('Alias cannot be empty');
      return false;
    }

    if (value.length > 64) {
      setError('Alias must be 64 characters or less');
      return false;
    }

    // Check alphanumeric, underscore, hyphen only
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      setError('Alias can only contain letters, numbers, underscores, and hyphens');
      return false;
    }

    // Cannot start with number
    if (/^[0-9]/.test(value)) {
      setError('Alias cannot start with a number');
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!validateAlias(alias)) {
      return;
    }

    if (alias === database.alias) {
      onClose();
      return;
    }

    try {
      await updateAliasMutation.mutateAsync({
        connectionId,
        dbName: database.name,
        newAlias: alias,
      });
      onClose();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to update alias');
    }
  };

  const handleAliasChange = (value: string) => {
    setAlias(value);
    if (error) {
      validateAlias(value);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Database Alias">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            The alias is used to identify this database in MCP tools and the UI. It must be unique across all
            databases.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
            Database: <span className="font-mono">{database.name}</span>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Alias
          </label>
          <Input
            value={alias}
            onChange={(e) => handleAliasChange(e.target.value)}
            placeholder="Enter database alias"
            disabled={updateAliasMutation.isPending}
            error={error || undefined}
          />
          {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
          <p>Alias rules:</p>
          <ul className="list-disc list-inside pl-2 space-y-0.5">
            <li>Must be 1-64 characters</li>
            <li>Can only contain letters, numbers, underscores, and hyphens</li>
            <li>Cannot start with a number</li>
            <li>Must be unique across all databases</li>
          </ul>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} fullWidth disabled={updateAliasMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            fullWidth
            loading={updateAliasMutation.isPending}
            disabled={!!error || alias === database.alias}
          >
            Save Alias
          </Button>
        </div>
      </div>
    </Modal>
  );
};
