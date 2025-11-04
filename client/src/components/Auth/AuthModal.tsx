import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key } from 'lucide-react';
import { Modal, Input, Button, Alert } from '../Common';
import { useAuth } from './AuthContext';

interface AuthModalProps {
  isOpen: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen }) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login(token);
      if (success) {
        // Redirect to dashboard on successful authentication
        navigate('/');
      } else {
        setError('Invalid API key. Please check and try again.');
      }
    } catch (err) {
      setError('Failed to authenticate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => {}} showCloseButton={false} size="sm">
      <div className="text-center mb-6">
        <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <Key className="w-6 h-6 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to MySQL MCP WebUI</h2>
        <p className="text-gray-600">Please enter your API key to continue</p>
      </div>

      {error && (
        <Alert type="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="API Key"
          type="password"
          placeholder="Enter your API key"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          fullWidth
          autoFocus
          required
        />

        <Button type="submit" fullWidth loading={loading}>
          Authenticate
        </Button>

        <div className="text-sm text-gray-500 text-center">
          <p>Don't have an API key?</p>
          <p className="mt-1">Check your server console for the default key or contact your administrator.</p>
        </div>
      </form>
    </Modal>
  );
};
