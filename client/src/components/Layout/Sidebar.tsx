import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Database,
  Server,
  Play,
  Settings,
  Key,
  FileText,
  Table2,
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: <Home className="w-5 h-5" /> },
  { path: '/connections', label: 'Connections', icon: <Server className="w-5 h-5" /> },
  { path: '/databases', label: 'Databases', icon: <Database className="w-5 h-5" /> },
  { path: '/browse', label: 'Browse Data', icon: <Table2 className="w-5 h-5" /> },
  { path: '/query', label: 'Query Tester', icon: <Play className="w-5 h-5" /> },
  { path: '/api-keys', label: 'API Keys', icon: <Key className="w-5 h-5" /> },
  { path: '/logs', label: 'Request Logs', icon: <FileText className="w-5 h-5" /> },
  { path: '/settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200 min-h-screen">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
