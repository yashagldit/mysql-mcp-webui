import React, { useState } from 'react';
import { CodeBlock } from '../Common';
import type { Settings } from '../../types';

interface McpConfigSnippetProps {
  settings?: Settings;
}

export const McpConfigSnippet: React.FC<McpConfigSnippetProps> = ({ settings }) => {
  const [mode, setMode] = useState<'http' | 'stdio'>('http');

  const httpConfig = `{
  "mcpServers": {
    "mysql-mcp": {
      "type": "http",
      "url": "http://localhost:${settings?.httpPort || 9274}/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`;

  const stdioConfig = `{
  "mcpServers": {
    "mysql-mcp": {
      "command": "node",
      "args": [
        "/path/to/mysql-mcp-webui/server/dist/index.js"
      ],
      "env": {
        "AUTH_TOKEN": "YOUR_API_KEY",
        "TRANSPORT": "stdio"
      }
    }
  }
}`;

  return (
    <div className="space-y-4">
      {/* Mode Tabs */}
      <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setMode('http')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mode === 'http'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          HTTP Mode
        </button>
        <button
          onClick={() => setMode('stdio')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mode === 'stdio'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          Stdio Mode
        </button>
      </div>

      {/* Config Snippet */}
      {mode === 'http' ? (
        <div>
          <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium mb-1">HTTP Mode (Recommended for Remote/Running Server)</p>
            <p>Connect to an already-running MCP server over HTTP. Use this if:</p>
            <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
              <li>The server is already running (manually started or via docker)</li>
              <li>You need remote access or production deployments</li>
              <li>You want to keep the server running independently</li>
            </ul>
          </div>
          <CodeBlock code={httpConfig} language="json" />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Note: Make sure the server is running before connecting (npm start or docker run)
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium mb-1">Stdio Mode (Recommended for Local/Managed)</p>
            <p>Let Claude Desktop start and manage the MCP server. Use this if:</p>
            <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
              <li>You want Claude Desktop to automatically start/stop the server</li>
              <li>You're running locally and want simpler setup</li>
              <li>You prefer the server only runs when Claude is active</li>
            </ul>
          </div>
          <CodeBlock code={stdioConfig} language="json" />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Note: Update the path to point to your actual installation directory
          </p>
        </div>
      )}
    </div>
  );
};
