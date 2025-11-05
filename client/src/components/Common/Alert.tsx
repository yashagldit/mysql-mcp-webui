import React from 'react';
import { AlertCircle, CheckCircle, Info, XCircle, X } from 'lucide-react';

interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  children,
  onClose,
  className = '',
}) => {
  const styles = {
    info: {
      container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      icon: 'text-blue-600 dark:text-blue-400',
      title: 'text-blue-900 dark:text-blue-300',
      text: 'text-blue-800 dark:text-blue-300',
      IconComponent: Info,
    },
    success: {
      container: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      icon: 'text-green-600 dark:text-green-400',
      title: 'text-green-900 dark:text-green-300',
      text: 'text-green-800 dark:text-green-300',
      IconComponent: CheckCircle,
    },
    warning: {
      container: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      icon: 'text-yellow-600 dark:text-yellow-400',
      title: 'text-yellow-900 dark:text-yellow-300',
      text: 'text-yellow-800 dark:text-yellow-300',
      IconComponent: AlertCircle,
    },
    error: {
      container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      icon: 'text-red-600 dark:text-red-400',
      title: 'text-red-900 dark:text-red-300',
      text: 'text-red-800 dark:text-red-300',
      IconComponent: XCircle,
    },
  };

  const style = styles[type];
  const Icon = style.IconComponent;

  return (
    <div className={`rounded-lg border p-4 ${style.container} ${className}`}>
      <div className="flex items-start">
        <Icon className={`w-5 h-5 ${style.icon} flex-shrink-0 mt-0.5`} />
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={`text-sm font-medium ${style.title} mb-1`}>
              {title}
            </h3>
          )}
          <div className={`text-sm ${style.text}`}>
            {children}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`ml-3 ${style.icon} hover:opacity-70 transition-opacity`}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
