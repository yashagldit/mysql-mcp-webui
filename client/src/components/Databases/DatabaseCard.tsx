import React, { useState } from 'react';
import { Database as DatabaseIcon, Check, Shield } from 'lucide-react';
import { Card, Badge, Button } from '../Common';
import { PermissionsModal } from './PermissionsModal';
import { useActivateDatabase } from '../../hooks/useDatabases';
import type { Database } from '../../types';
import { getPermissionCount } from '../../lib/utils';

interface DatabaseCardProps {
  database: Database;
  connectionId: string;
}

export const DatabaseCard: React.FC<DatabaseCardProps> = ({ database, connectionId }) => {
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const activateMutation = useActivateDatabase();

  const permissions = database.permissions;

  const permissionCount = getPermissionCount(permissions);

  const handleActivate = async () => {
    try {
      await activateMutation.mutateAsync({
        connectionId,
        dbName: database.name,
      });
    } catch (error) {
      console.error('Failed to activate database:', error);
    }
  };

  return (
    <>
      <Card hoverable className="relative">
        {database.isActive && (
          <div className="absolute top-4 right-4">
            <Badge variant="success" size="sm">
              Active
            </Badge>
          </div>
        )}

        <div className="flex items-start space-x-3 mb-4">
          <div className="p-2 bg-green-50 rounded-lg">
            <DatabaseIcon className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{database.name}</h3>
            <p className="text-sm text-gray-600">
              {permissionCount} permission{permissionCount !== 1 ? 's' : ''} enabled
            </p>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex flex-wrap gap-1">
            {permissions.select && (
              <Badge size="sm" variant="info">
                SELECT
              </Badge>
            )}
            {permissions.insert && (
              <Badge size="sm" variant="success">
                INSERT
              </Badge>
            )}
            {permissions.update && (
              <Badge size="sm" variant="warning">
                UPDATE
              </Badge>
            )}
            {permissions.delete && (
              <Badge size="sm" variant="danger">
                DELETE
              </Badge>
            )}
            {permissions.create && (
              <Badge size="sm" variant="default">
                CREATE
              </Badge>
            )}
            {permissions.alter && (
              <Badge size="sm" variant="default">
                ALTER
              </Badge>
            )}
            {permissions.drop && (
              <Badge size="sm" variant="danger">
                DROP
              </Badge>
            )}
            {permissions.truncate && (
              <Badge size="sm" variant="danger">
                TRUNCATE
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {!database.isActive && (
            <Button
              size="sm"
              variant="primary"
              onClick={handleActivate}
              loading={activateMutation.isPending}
              fullWidth
            >
              <Check className="w-4 h-4 mr-1" />
              Activate
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowPermissionsModal(true)}
            fullWidth
            className={database.isActive ? 'col-span-2' : ''}
          >
            <Shield className="w-4 h-4 mr-1" />
            Permissions
          </Button>
        </div>
      </Card>

      <PermissionsModal
        database={database}
        connectionId={connectionId}
        isOpen={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
      />
    </>
  );
};
