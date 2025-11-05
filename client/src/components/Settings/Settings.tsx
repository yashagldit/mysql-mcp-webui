import React from 'react';
import { Server, Key, Code } from 'lucide-react';
import { Card, Badge, Alert } from '../Common';
import { McpConfigSnippet } from './McpConfigSnippet';
import { useSettings } from '../../hooks/useActiveState';
import { useApiKeys } from '../../hooks/useApiKeys';

export const Settings: React.FC = () => {
  const { data: settings, isLoading } = useSettings();
  const { data: apiKeys } = useApiKeys();

  const activeKeys = apiKeys?.filter((key) => key.isActive) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Server configuration and MCP client setup</p>
      </div>

      {/* Server Info */}
      <Card>
        <div className="flex items-start space-x-3 mb-4">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Server className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Server Information</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Current server configuration</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Transport Mode</label>
            <div className="mt-1">
              <Badge variant={settings?.transport === 'http' ? 'success' : 'info'}>
                {settings?.transport?.toUpperCase() || 'N/A'}
              </Badge>
            </div>
          </div>
          {settings?.transport === 'http' && (
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">HTTP Port</label>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{settings.httpPort}</p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Node Version</label>
            <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{settings?.nodeVersion || 'N/A'}</p>
          </div>
        </div>
      </Card>

      {/* API Keys Summary */}
      <Card>
        <div className="flex items-start space-x-3 mb-4">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Key className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">API Keys</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage authentication keys</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Keys:</span>
            <Badge variant="default">{apiKeys?.length || 0}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Active Keys:</span>
            <Badge variant="success">{activeKeys.length}</Badge>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <a
            href="/api-keys"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Manage API Keys →
          </a>
        </div>
      </Card>

      {/* MCP Configuration */}
      <Card>
        <div className="flex items-start space-x-3 mb-4">
          <div className="p-2 bg-green-50 rounded-lg">
            <Code className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">MCP Client Configuration</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Copy and paste these configurations into your MCP client
            </p>
          </div>
        </div>

        {activeKeys.length === 0 && (
          <Alert type="warning" className="mb-4">
            You need to create an API key before you can use the MCP server. Go to the API Keys
            page to create one.
          </Alert>
        )}

        <McpConfigSnippet settings={settings} />
      </Card>

      {/* Instructions */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Setup Instructions</h2>
        <ol className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-blue-600">1.</span>
            <span>
              Create an API key from the API Keys page if you haven't already
            </span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-blue-600">2.</span>
            <span>
              Copy the appropriate configuration snippet above (HTTP or Stdio mode)
            </span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-blue-600">3.</span>
            <span>
              Paste the configuration into your MCP client's configuration file
            </span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-blue-600">4.</span>
            <span>Replace <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">YOUR_API_KEY</code> with your actual API key</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-blue-600">5.</span>
            <span>Restart your MCP client to apply the changes</span>
          </li>
        </ol>
      </Card>
    </div>
  );
};
