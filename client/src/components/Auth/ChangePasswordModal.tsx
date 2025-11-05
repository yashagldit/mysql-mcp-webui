import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { Modal, Input, Button, Alert } from '../Common';
import { apiClient } from '../../api/client';
import { useAuth } from './AuthContext';

interface ChangePasswordModalProps {
  isOpen: boolean;
  isForced?: boolean;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, isForced = false }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }

    // Validate minimum length
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters long');
      return;
    }

    setLoading(true);

    try {
      const payload = isForced
        ? { newPassword, confirmPassword }
        : { currentPassword, newPassword, confirmPassword };

      const response = await apiClient.post('/auth/change-password', payload);

      if (response.data.success) {
        // Refresh user data to update must_change_password flag
        await refreshUser();

        // Reset form
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(response.data.error || 'Failed to change password');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to change password. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => {}} showCloseButton={!isForced} size="sm">
      <div className="text-center mb-6">
        <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-yellow-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isForced ? 'Change Your Password' : 'Update Password'}
        </h2>
        <p className="text-gray-600">
          {isForced
            ? 'You must change your password before continuing'
            : 'Update your password to keep your account secure'}
        </p>
      </div>

      {isForced && (
        <Alert type="warning" className="mb-4">
          For security reasons, you must change the default password before using the application.
        </Alert>
      )}

      {error && (
        <Alert type="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isForced && (
          <Input
            label="Current Password"
            type="password"
            placeholder="Enter your current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            fullWidth
            autoFocus
            required
          />
        )}

        <Input
          label="New Password"
          type="password"
          placeholder="Enter your new password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          fullWidth
          autoFocus={isForced}
          required
          minLength={4}
        />

        <Input
          label="Confirm New Password"
          type="password"
          placeholder="Confirm your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          fullWidth
          required
          minLength={4}
        />

        <div className="flex gap-3">
          {!isForced && (
            <Button type="button" variant="secondary" fullWidth onClick={() => {
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              setError('');
            }}>
              Cancel
            </Button>
          )}
          <Button type="submit" fullWidth loading={loading}>
            Change Password
          </Button>
        </div>

        {newPassword.length > 0 && newPassword.length < 4 && (
          <p className="text-xs text-gray-500 text-center">
            Password must be at least 4 characters long
          </p>
        )}
      </form>
    </Modal>
  );
};
