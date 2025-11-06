import React from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '../../contexts/ThemeContext';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({ value, onChange }) => {
  const { resolvedTheme } = useTheme();

  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <Editor
        height="300px"
        defaultLanguage="sql"
        value={value}
        onChange={handleEditorChange}
        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light'}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          padding: { top: 10, bottom: 10 },
          suggest: {
            showKeywords: true,
            showSnippets: true,
          },
        }}
      />
    </div>
  );
};
