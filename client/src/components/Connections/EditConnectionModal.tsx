import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Alert } from '../Common';
import { useUpdateConnection } from '../../hooks/useConnections';
import type { Connection, UpdateConnectionRequest } from '../../types';

interface EditConnectionModalProps {
  connection: Connection;
  isOpen: boolean;
  onClose: () => void;
}

export const EditConnectionModal: React.FC<EditConnectionModalProps> = ({
  connection,
  isOpen,
  onClose,
}) => {
  const [formData, setFormData] = useState<UpdateConnectionRequest>({
    name: connection.name,
    host: connection.host,
    port: connection.port,
    user: connection.user,
    password: '',
  });

  const updateMutation = useUpdateConnection();

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: connection.name,
        host: connection.host,
        port: connection.port,
        user: connection.user,
        password: '',
      });
    }
  }, [isOpen, connection]);

  const handleChange = (field: keyof UpdateConnectionRequest, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Only send fields that were changed
    const updates: UpdateConnectionRequest = {};
    if (formData.name !== connection.name) updates.name = formData.name;
    if (formData.host !== connection.host) updates.host = formData.host;
    if (formData.port !== connection.port) updates.port = formData.port;
    if (formData.user !== connection.user) updates.user = formData.user;
    if (formData.password) updates.password = formData.password;

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    try {
      await updateMutation.mutateAsync({ id: connection.id, updates });
      onClose();
    } catch (error) {
      console.error('Failed to update connection:', error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Connection" size="md">
      {updateMutation.isError && (
        <Alert type="error" className="mb-4">
          Failed to update connection. Please try again.
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Connection Name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          required
        />

        <Input
          label="Host"
          value={formData.host}
          onChange={(e) => handleChange('host', e.target.value)}
          required
        />

        <Input
          label="Port"
          type="number"
          value={formData.port}
          onChange={(e) => handleChange('port', parseInt(e.target.value))}
          required
        />

        <Input
          label="User"
          value={formData.user}
          onChange={(e) => handleChange('user', e.target.value)}
          required
        />

        <Input
          label="New Password (leave empty to keep current)"
          type="password"
          value={formData.password}
          onChange={(e) => handleChange('password', e.target.value)}
          helperText="Only fill this if you want to change the password"
        />

        <div className="flex space-x-2 pt-4">
          <Button type="submit" loading={updateMutation.isPending}>
            Save Changes
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
};
