import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  maxHeight?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'text',
  showLineNumbers = false,
  maxHeight,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const lines = code.split('\n');

  return (
    <div className="relative group">
      <div className="bg-gray-900 rounded-lg overflow-hidden flex flex-col" style={{ maxHeight }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <span className="text-xs text-gray-400 uppercase">{language}</span>
          <button
            onClick={handleCopy}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Code */}
        <div className="overflow-auto p-4 flex-1">
          <pre className="text-sm text-gray-100 font-mono">
            {showLineNumbers ? (
              <table className="w-full">
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index}>
                      <td className="text-gray-500 select-none pr-4 text-right" style={{ width: '1%' }}>
                        {index + 1}
                      </td>
                      <td>
                        <code>{line || ' '}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <code>{code}</code>
            )}
          </pre>
        </div>
      </div>
    </div>
  );
};
