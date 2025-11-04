import React, { useState } from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { Modal, Input, Button, Alert } from '../Common';
import { useCreateApiKey } from '../../hooks/useApiKeys';

interface CreateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateKeyModal: React.FC<CreateKeyModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useCreateApiKey();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const result = await createMutation.mutateAsync({ name: name.trim() });
      setCreatedKey(result.key);
      setName('');
    } catch (error) {
      console.error('Failed to create API key:', error);
    }
  };

  const handleCopy = async () => {
    if (createdKey) {
      try {
        await navigator.clipboard.writeText(createdKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleClose = () => {
    setCreatedKey(null);
    setName('');
    setCopied(false);
    onClose();
  };

  if (createdKey) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="API Key Created" size="md">
        <Alert type="warning" className="mb-4">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Save this key now!</p>
              <p className="text-sm mt-1">
                This is the only time you'll see the complete key. Store it securely.
              </p>
            </div>
          </div>
        </Alert>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Your API Key</label>
            <div className="relative">
              <input
                type="text"
                value={createdKey}
                readOnly
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
              />
              <button
                onClick={handleCopy}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button onClick={handleClose} fullWidth>
            I've Saved the Key
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New API Key" size="md">
      {createMutation.isError && (
        <Alert type="error" className="mb-4">
          Failed to create API key. Please try again.
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Key Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Production Server, Development, CI/CD, etc."
          helperText="Give this key a descriptive name to identify its purpose"
          required
          autoFocus
        />

        <div className="flex space-x-2 pt-4">
          <Button type="submit" loading={createMutation.isPending}>
            Create Key
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
};
