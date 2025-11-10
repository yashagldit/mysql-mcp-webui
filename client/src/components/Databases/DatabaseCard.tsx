import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database as DatabaseIcon, Check, Shield, Table2, Eye, EyeOff, Edit } from 'lucide-react';
import { Card, Badge, Button } from '../Common';
import { PermissionsModal } from './PermissionsModal';
import { EditAliasModal } from './EditAliasModal';
import { useActivateDatabase, useEnableDatabase, useDisableDatabase } from '../../hooks/useDatabases';
import type { Database } from '../../types';
import { getPermissionCount } from '../../lib/utils';

interface DatabaseCardProps {
  database: Database;
  connectionId: string;
}

export const DatabaseCard: React.FC<DatabaseCardProps> = ({ database, connectionId }) => {
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showEditAliasModal, setShowEditAliasModal] = useState(false);
  const activateMutation = useActivateDatabase();
  const enableMutation = useEnableDatabase();
  const disableMutation = useDisableDatabase();
  const navigate = useNavigate();

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

  const handleToggleEnabled = async () => {
    try {
      if (database.isEnabled) {
        await disableMutation.mutateAsync({
          connectionId,
          dbName: database.name,
        });
      } else {
        await enableMutation.mutateAsync({
          connectionId,
          dbName: database.name,
        });
      }
    } catch (error) {
      console.error('Failed to toggle database enabled state:', error);
    }
  };

  const handleBrowse = async () => {
    // Activate database if not already active, then navigate to browse page
    if (!database.isActive) {
      try {
        await activateMutation.mutateAsync({
          connectionId,
          dbName: database.name,
        });
      } catch (error) {
        console.error('Failed to activate database:', error);
        return;
      }
    }
    navigate('/browse');
  };

  return (
    <>
      <Card hoverable className={`relative ${!database.isEnabled ? 'opacity-60' : ''}`}>
        <div className="absolute top-4 right-4 flex gap-2">
          {database.isActive && (
            <Badge variant="success" size="sm">
              Active
            </Badge>
          )}
          {!database.isEnabled && (
            <Badge variant="danger" size="sm">
              Disabled
            </Badge>
          )}
        </div>

        <div className="flex items-start space-x-3 mb-4">
          <div className="p-2 bg-green-50 rounded-lg">
            <DatabaseIcon className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{database.alias}</h3>
              <button
                onClick={() => setShowEditAliasModal(true)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Edit alias"
              >
                <Edit className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {database.name}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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

        <div className="flex flex-col gap-2">
          {!database.isActive && (
            <Button
              size="sm"
              variant="primary"
              onClick={handleActivate}
              loading={activateMutation.isPending}
              fullWidth
              disabled={!database.isEnabled}
            >
              <Check className="w-4 h-4 mr-1" />
              Activate
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleBrowse}
              loading={activateMutation.isPending}
              fullWidth
              disabled={!database.isEnabled}
            >
              <Table2 className="w-4 h-4 mr-1" />
              Browse
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowPermissionsModal(true)}
              fullWidth
            >
              <Shield className="w-4 h-4 mr-1" />
              Permissions
            </Button>
          </div>
          <Button
            size="sm"
            variant={database.isEnabled ? 'danger' : 'primary'}
            onClick={handleToggleEnabled}
            loading={enableMutation.isPending || disableMutation.isPending}
            fullWidth
          >
            {database.isEnabled ? (
              <>
                <EyeOff className="w-4 h-4 mr-1" />
                Disable for MCP
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-1" />
                Enable for MCP
              </>
            )}
          </Button>
        </div>
      </Card>

      <PermissionsModal
        database={database}
        connectionId={connectionId}
        isOpen={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
      />

      <EditAliasModal
        database={database}
        connectionId={connectionId}
        isOpen={showEditAliasModal}
        onClose={() => setShowEditAliasModal(false)}
      />
    </>
  );
};
