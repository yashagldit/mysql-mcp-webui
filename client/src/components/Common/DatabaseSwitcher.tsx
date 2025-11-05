import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Loader2, Database } from 'lucide-react';
import { Badge } from './Badge';
import { useActiveState } from '../../hooks/useActiveState';
import { useDatabases, useActivateDatabase } from '../../hooks/useDatabases';

export const DatabaseSwitcher: React.FC = () => {
  const { data: activeState } = useActiveState();
  const { data: databases } = useDatabases(activeState?.connectionId || '');
  const activateDatabase = useActivateDatabase();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Don't render if no active database
  if (!activeState?.database) {
    return <Badge variant="success">No Database</Badge>;
  }

  // Don't render switcher if no connection or no databases
  if (!activeState?.connectionId || !databases || databases.length <= 1) {
    return <Badge variant="success">{activeState.database}</Badge>;
  }

  const handleDatabaseSwitch = async (dbName: string) => {
    if (!activeState?.connectionId) return;

    try {
      await activateDatabase.mutateAsync({
        connectionId: activeState.connectionId,
        dbName,
      });
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch database:', error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 rounded-md text-xs font-medium hover:bg-green-200 transition-colors"
      >
        <span>{activeState.database}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1 mb-1">
              Switch Database
            </div>
            {databases.map((db) => {
              const isActive = db.name === activeState.database;
              const isSwitching =
                activateDatabase.isPending &&
                activateDatabase.variables?.dbName === db.name;

              return (
                <button
                  key={db.name}
                  onClick={() => handleDatabaseSwitch(db.name)}
                  disabled={isActive || isSwitching}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-green-50 dark:bg-green-900/30 text-green-900 dark:text-green-100'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Database className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                    <span className="font-medium truncate">{db.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {/* Permission count */}
                    {db.permissions && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {Object.values(db.permissions).filter(Boolean).length}
                      </span>
                    )}
                    {/* Status indicator */}
                    {isSwitching ? (
                      <Loader2 className="w-4 h-4 text-green-600 animate-spin" />
                    ) : isActive ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
