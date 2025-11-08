import React from 'react';
import { Link } from 'react-router-dom';
import { Database, Activity, Sun, Moon, Monitor, Menu, LogOut } from 'lucide-react';
import { Badge, DatabaseSwitcher, Toggle } from '../Common';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings, useToggleMcp } from '../../hooks/useActiveState';
import { useAuth } from '../Auth';

interface HeaderProps {
  activeConnection?: string;
  activeDatabase?: string;
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeConnection,
  activeDatabase,
  onMenuToggle,
}) => {
  const { theme, setTheme } = useTheme();
  const { data: settings } = useSettings();
  const toggleMcp = useToggleMcp();
  const { logout, user } = useAuth();

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="w-5 h-5" />;
      case 'dark':
        return <Moon className="w-5 h-5" />;
      case 'system':
        return <Monitor className="w-5 h-5" />;
    }
  };

  const handleMcpToggle = (enabled: boolean) => {
    toggleMcp.mutate(enabled);
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 md:px-6 py-3 md:py-4">
      <div className="flex items-center justify-between gap-2 md:gap-4">
        {/* Left section with menu and logo */}
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          {/* Mobile menu button */}
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300"
            aria-label="Toggle menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <Link to="/" className="flex items-center gap-2 min-w-0">
            <Database className="w-6 h-6 md:w-8 md:h-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <h1 className="text-base md:text-xl font-bold text-gray-900 dark:text-gray-100 truncate hidden sm:block">
              MySQL MCP WebUI
            </h1>
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate sm:hidden">
              MCP
            </h1>
          </Link>

          {/* Active connection info - hidden on mobile */}
          {activeConnection && (
            <div className="hidden xl:flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">Connection:</span>
                <Badge variant="info">{activeConnection}</Badge>
                {activeDatabase && (
                  <>
                    <span className="text-gray-400 dark:text-gray-500">/</span>
                    <DatabaseSwitcher />
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right section with controls */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* MCP Status and Toggle */}
          <div className="hidden sm:flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center gap-2">
              <span className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">MCP</span>
              <Badge variant={settings?.mcpEnabled ? 'success' : 'default'}>
                {settings?.mcpEnabled ? 'On' : 'Off'}
              </Badge>
            </div>
            <Toggle
              checked={settings?.mcpEnabled ?? true}
              onChange={handleMcpToggle}
              size="sm"
              disabled={toggleMcp.isPending}
            />
          </div>

          {/* Theme toggle */}
          <button
            onClick={cycleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 text-gray-600 dark:text-gray-300"
            title={`Current theme: ${theme}`}
            aria-label="Toggle theme"
          >
            {getThemeIcon()}
          </button>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 text-gray-600 dark:text-gray-300"
            title={user ? `Logout (${user.username})` : 'Logout'}
            aria-label="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>

          {/* Connection status - hidden on small mobile */}
          <div className="hidden md:flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-600 dark:text-gray-300">Connected</span>
          </div>
        </div>
      </div>

      {/* Mobile active connection info */}
      {activeConnection && (
        <div className="flex xl:hidden items-center gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Activity className="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-xs text-gray-600 dark:text-gray-300">Connection:</span>
            <Badge variant="info">{activeConnection}</Badge>
            {activeDatabase && (
              <>
                <span className="text-gray-400 dark:text-gray-500">/</span>
                <DatabaseSwitcher />
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
