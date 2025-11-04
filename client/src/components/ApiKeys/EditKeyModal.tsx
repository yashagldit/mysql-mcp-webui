import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Alert } from '../Common';
import { useUpdateApiKey } from '../../hooks/useApiKeys';
import type { ApiKey } from '../../types';

interface EditKeyModalProps {
  apiKey: ApiKey;
  isOpen: boolean;
  onClose: () => void;
}

export const EditKeyModal: React.FC<EditKeyModalProps> = ({ apiKey, isOpen, onClose }) => {
  const [name, setName] = useState(apiKey.name);
  const updateMutation = useUpdateApiKey();

  useEffect(() => {
    if (isOpen) {
      setName(apiKey.name);
    }
  }, [isOpen, apiKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name === apiKey.name) {
      onClose();
      return;
    }

    try {
      await updateMutation.mutateAsync({ id: apiKey.id, request: { name: name.trim() } });
      onClose();
    } catch (error) {
      console.error('Failed to update API key:', error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rename API Key" size="sm">
      {updateMutation.isError && (
        <Alert type="error" className="mb-4">
          Failed to update API key. Please try again.
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Key Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter new name"
          required
          autoFocus
        />

        <div className="flex space-x-2">
          <Button type="submit" loading={updateMutation.isPending}>
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
