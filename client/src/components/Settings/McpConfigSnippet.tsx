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
      "url": "http://localhost:${settings?.httpPort || 3000}/mcp",
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
      <div className="flex space-x-2 border-b border-gray-200">
        <button
          onClick={() => setMode('http')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mode === 'http'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          HTTP Mode
        </button>
        <button
          onClick={() => setMode('stdio')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mode === 'stdio'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Stdio Mode
        </button>
      </div>

      {/* Config Snippet */}
      {mode === 'http' ? (
        <div>
          <div className="mb-2 text-sm text-gray-600">
            <p className="font-medium mb-1">HTTP Mode (Recommended)</p>
            <p>Connect to the MCP server over HTTP. Suitable for remote access and production deployments.</p>
          </div>
          <CodeBlock code={httpConfig} language="json" />
        </div>
      ) : (
        <div>
          <div className="mb-2 text-sm text-gray-600">
            <p className="font-medium mb-1">Stdio Mode</p>
            <p>Run the MCP server as a subprocess. More efficient for local usage.</p>
          </div>
          <CodeBlock code={stdioConfig} language="json" />
          <p className="mt-2 text-xs text-gray-500">
            Note: Update the path to point to your actual installation directory
          </p>
        </div>
      )}
    </div>
  );
};
