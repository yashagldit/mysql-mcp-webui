import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, User } from 'lucide-react';
import { Modal, Input, Button, Alert } from '../Common';
import { useAuth } from './AuthContext';

interface AuthModalProps {
  isOpen: boolean;
}

type LoginMode = 'credentials' | 'token';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen }) => {
  const [mode, setMode] = useState<LoginMode>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
      const credentials = mode === 'credentials'
        ? { username, password }
        : { token };

      const result = await login(credentials);
      if (result.success) {
        // Redirect to dashboard on successful authentication
        navigate('/');
      } else {
        setError(result.error || 'Authentication failed. Please check your credentials.');
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
        <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
          {mode === 'credentials' ? (
            <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          ) : (
            <Key className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Welcome to MySQL MCP WebUI</h2>
        <p className="text-gray-600 dark:text-gray-400">
          {mode === 'credentials'
            ? 'Please enter your credentials to continue'
            : 'Please enter your API key to continue'}
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => { setMode('credentials'); setError(''); }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            mode === 'credentials'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          Username & Password
        </button>
        <button
          type="button"
          onClick={() => { setMode('token'); setError(''); }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            mode === 'token'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          API Token
        </button>
      </div>

      {error && (
        <Alert type="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'credentials' ? (
          <>
            <Input
              label="Username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
              autoFocus
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
            />
          </>
        ) : (
          <Input
            label="API Token"
            type="password"
            placeholder="Enter your API token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            fullWidth
            autoFocus
            required
          />
        )}

        <Button type="submit" fullWidth loading={loading}>
          {mode === 'credentials' ? 'Sign In' : 'Authenticate'}
        </Button>

        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
          {mode === 'credentials' ? (
            <p>Default credentials: <span className="font-mono">admin / admin</span></p>
          ) : (
            <>
              <p>Don't have an API token?</p>
              <p className="mt-1">Check your server console for the default key or contact your administrator.</p>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
};
