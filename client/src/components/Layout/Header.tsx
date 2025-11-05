import React from 'react';
import { Link } from 'react-router-dom';
import { Database, Activity, Sun, Moon, Monitor } from 'lucide-react';
import { Badge, DatabaseSwitcher } from '../Common';
import { useTheme } from '../../contexts/ThemeContext';

interface HeaderProps {
  activeConnection?: string;
  activeDatabase?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeConnection,
  activeDatabase,
}) => {
  const { theme, setTheme } = useTheme();

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

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/" className="flex items-center space-x-2">
            <Database className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">MySQL MCP WebUI</h1>
          </Link>

          {activeConnection && (
            <div className="flex items-center space-x-2 ml-8">
              <Activity className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <div className="flex items-center space-x-2">
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

        <div className="flex items-center space-x-4">
          <button
            onClick={cycleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 text-gray-600 dark:text-gray-300"
            title={`Current theme: ${theme}`}
            aria-label="Toggle theme"
          >
            {getThemeIcon()}
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-600 dark:text-gray-300">Connected</span>
          </div>
        </div>
      </div>
    </header>
  );
};
