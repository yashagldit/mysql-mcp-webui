import { Routes, Route } from 'react-router-dom';
import { AuthProvider, ProtectedRoute, useAuth } from './components/Auth';
import { ChangePasswordModal } from './components/Auth/ChangePasswordModal';
import { InactivityWarningModal } from './components/Auth/InactivityWarningModal';
import { ThemeProvider } from './contexts/ThemeContext';
import { LayoutWrapper } from './components/Layout/LayoutWrapper';
import { Dashboard } from './pages/Dashboard';
import { AuthPage } from './pages/AuthPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { DatabasesPage } from './pages/DatabasesPage';
import { BrowserPage } from './pages/BrowserPage';
import { QueryPage } from './pages/QueryPage';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { LogsPage } from './pages/LogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { useSettings } from './hooks/useActiveState';
import { useInactivityLogout } from './hooks/useInactivityLogout';

function AppContent() {
  const { user, isAuthenticated } = useAuth();
  const { data: settings } = useSettings();

  // Auto logout for WebUI users (JWT auth with user object)
  // API token users are excluded (user === null)
  const { warningSecondsRemaining, extendSession } = useInactivityLogout({
    timeoutMs: settings?.inactivityTimeoutMs || 1800000, // Default 30 minutes
    warningMs: 60000, // Warn 60 seconds before logout
  });

  return (
    <>
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
                  <Route path="/browse" element={<BrowserPage />} />
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

      {/* Force password change modal */}
      {isAuthenticated && user?.must_change_password && (
        <ChangePasswordModal isOpen={true} isForced={true} />
      )}

      {/* Inactivity warning modal (WebUI users only) */}
      {warningSecondsRemaining !== null && (
        <InactivityWarningModal
          isOpen={true}
          secondsRemaining={warningSecondsRemaining}
          onStayLoggedIn={extendSession}
        />
      )}
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
