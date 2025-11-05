import React from 'react';
import { BarChart3, TrendingUp, Activity } from 'lucide-react';
import { Card } from '../Common';
import { useLogsStats } from '../../hooks/useLogs';

export const UsageStats: React.FC = () => {
  const { data: stats, isLoading } = useLogsStats();

  if (isLoading) {
    return null;
  }

  if (!stats) {
    return null;
  }

  const topApiKey = stats.byApiKey?.[0];
  const topEndpoint = stats.byEndpoint?.[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <Activity className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Requests</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalRequests}</p>
          </div>
        </div>
      </Card>

      {topApiKey && (
        <Card>
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600">Most Active Key</p>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {topApiKey.api_key_id}
              </p>
              <p className="text-xs text-gray-500">{topApiKey.count} requests</p>
            </div>
          </div>
        </Card>
      )}

      {topEndpoint && (
        <Card>
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600">Most Used Endpoint</p>
              <p className="text-sm font-mono font-semibold text-gray-900 truncate">
                {topEndpoint.endpoint}
              </p>
              <p className="text-xs text-gray-500">{topEndpoint.count} requests</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
