import { Routes, Route } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from './components/Auth';
import { LayoutWrapper } from './components/Layout/LayoutWrapper';
import { Dashboard } from './pages/Dashboard';
import { AuthPage } from './pages/AuthPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { DatabasesPage } from './pages/DatabasesPage';
import { QueryPage } from './pages/QueryPage';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { LogsPage } from './pages/LogsPage';
import { SettingsPage } from './pages/SettingsPage';

function AppContent() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <LayoutWrapper>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/connections" element={<ConnectionsPage />} />
                <Route path="/databases" element={<DatabasesPage />} />
                <Route path="/query" element={<QueryPage />} />
                <Route path="/api-keys" element={<ApiKeysPage />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </LayoutWrapper>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
