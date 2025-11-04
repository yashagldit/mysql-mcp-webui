import React, { useState } from 'react';
import { Modal, Input, Button, Alert } from '../Common';
import { useCreateConnection, useTestConnection } from '../../hooks/useConnections';
import type { CreateConnectionRequest } from '../../types';

interface AddConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddConnectionModal: React.FC<AddConnectionModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState<CreateConnectionRequest>({
    name: '',
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useCreateConnection();
  const testMutation = useTestConnection();

  const handleChange = (field: keyof CreateConnectionRequest, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.host.trim()) newErrors.host = 'Host is required';
    if (!formData.port || formData.port < 1 || formData.port > 65535) {
      newErrors.port = 'Port must be between 1 and 65535';
    }
    if (!formData.user.trim()) newErrors.user = 'User is required';
    if (!formData.password) newErrors.password = 'Password is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await createMutation.mutateAsync(formData);
      onClose();
      // Reset form
      setFormData({
        name: '',
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
      });
    } catch (error) {
      console.error('Failed to create connection:', error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add MySQL Connection" size="md">
      {createMutation.isError && (
        <Alert type="error" className="mb-4">
          Failed to create connection. Please check your details and try again.
        </Alert>
      )}

      {testMutation.isSuccess && testMutation.data && (
        <Alert type="success" className="mb-4">
          Connection test successful! Found {testMutation.data.databases.length} databases.
        </Alert>
      )}

      {testMutation.isError && (
        <Alert type="error" className="mb-4">
          Connection test failed. Please verify your credentials.
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Connection Name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          placeholder="My MySQL Server"
          required
        />

        <Input
          label="Host"
          value={formData.host}
          onChange={(e) => handleChange('host', e.target.value)}
          error={errors.host}
          placeholder="localhost"
          required
        />

        <Input
          label="Port"
          type="number"
          value={formData.port}
          onChange={(e) => handleChange('port', parseInt(e.target.value))}
          error={errors.port}
          placeholder="3306"
          required
        />

        <Input
          label="User"
          value={formData.user}
          onChange={(e) => handleChange('user', e.target.value)}
          error={errors.user}
          placeholder="root"
          required
        />

        <Input
          label="Password"
          type="password"
          value={formData.password}
          onChange={(e) => handleChange('password', e.target.value)}
          error={errors.password}
          placeholder="Enter password"
          required
        />

        <div className="flex space-x-2 pt-4">
          <Button type="submit" loading={createMutation.isPending}>
            Save Connection
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
};
