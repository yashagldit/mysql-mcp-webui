import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md',
}) => {
  const sizeStyles = {
    sm: {
      switch: 'w-9 h-5',
      dot: 'w-4 h-4',
      translate: 'translate-x-4',
    },
    md: {
      switch: 'w-11 h-6',
      dot: 'w-5 h-5',
      translate: 'translate-x-5',
    },
  };

  const styles = sizeStyles[size];

  return (
    <label className="flex items-center cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <div
          className={`
            ${styles.switch} rounded-full transition-colors duration-200
            ${checked ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />
        <div
          className={`
            ${styles.dot} bg-white rounded-full absolute top-0.5 left-0.5
            transition-transform duration-200 shadow-sm
            ${checked ? styles.translate : 'translate-x-0'}
          `}
        />
      </div>
      {label && (
        <span className={`ml-3 text-sm text-gray-700 dark:text-gray-300 ${disabled ? 'opacity-50' : ''}`}>
          {label}
        </span>
      )}
    </label>
  );
};
