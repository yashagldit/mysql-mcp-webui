import React from 'react';
import { Link } from 'react-router-dom';
import { Server, Database, Key, FileText, Activity } from 'lucide-react';
import { Card, Badge } from '../components/Common';
import { useConnections } from '../hooks/useConnections';
import { useActiveState } from '../hooks/useActiveState';
import { useApiKeys } from '../hooks/useApiKeys';

export const Dashboard: React.FC = () => {
  const { data: connections } = useConnections();
  const { data: activeState } = useActiveState();
  const { data: apiKeys } = useApiKeys();

  const stats = [
    {
      title: 'Connections',
      value: connections?.length || 0,
      icon: Server,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      link: '/connections',
    },
    {
      title: 'Active Database',
      value: activeState?.database || 'None',
      icon: Database,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      link: '/databases',
    },
    {
      title: 'API Keys',
      value: apiKeys?.length || 0,
      icon: Key,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      link: '/api-keys',
    },
    {
      title: 'Status',
      value: 'Healthy',
      icon: Activity,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      link: '/logs',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Overview of your MySQL MCP server configuration
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.title} to={stat.link}>
              <Card hoverable className="h-full">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Active Connection Info */}
      {activeState?.connectionName && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Connection</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Connection:</span>
              <Badge variant="info">{activeState.connectionName}</Badge>
            </div>
            {activeState.database && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Database:</span>
                <Badge variant="success">{activeState.database}</Badge>
              </div>
            )}
            {activeState.permissions && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Permissions:</span>
                <div className="flex gap-1 flex-wrap">
                  {Object.entries(activeState.permissions).map(([key, value]) =>
                    value ? (
                      <Badge key={key} size="sm" variant="default">
                        {key.toUpperCase()}
                      </Badge>
                    ) : null
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            to="/connections"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Server className="w-6 h-6 text-blue-600 mb-2" />
            <h3 className="font-medium text-gray-900">Manage Connections</h3>
            <p className="text-sm text-gray-600 mt-1">Add or edit MySQL connections</p>
          </Link>
          <Link
            to="/query"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText className="w-6 h-6 text-green-600 mb-2" />
            <h3 className="font-medium text-gray-900">Query Tester</h3>
            <p className="text-sm text-gray-600 mt-1">Execute SQL queries</p>
          </Link>
          <Link
            to="/api-keys"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Key className="w-6 h-6 text-purple-600 mb-2" />
            <h3 className="font-medium text-gray-900">API Keys</h3>
            <p className="text-sm text-gray-600 mt-1">Manage authentication keys</p>
          </Link>
        </div>
      </Card>
    </div>
  );
};
