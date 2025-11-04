import React from 'react';
import { Link } from 'react-router-dom';
import { Database, Activity } from 'lucide-react';
import { Badge, DatabaseSwitcher } from '../Common';

interface HeaderProps {
  activeConnection?: string;
  activeDatabase?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeConnection,
  activeDatabase,
}) => {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/" className="flex items-center space-x-2">
            <Database className="w-8 h-8 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">MySQL MCP WebUI</h1>
          </Link>

          {activeConnection && (
            <div className="flex items-center space-x-2 ml-8">
              <Activity className="w-4 h-4 text-gray-500" />
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Connection:</span>
                <Badge variant="info">{activeConnection}</Badge>
                {activeDatabase && (
                  <>
                    <span className="text-gray-400">/</span>
                    <DatabaseSwitcher />
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-gray-600">Connected</span>
        </div>
      </div>
    </header>
  );
};
