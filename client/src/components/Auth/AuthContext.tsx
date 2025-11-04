import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../../api/client';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user has valid token on mount
    const checkAuth = async () => {
      const token = apiClient.getAuthToken();

      // If no token exists, try accessing API without auth (for localhost no-auth scenario)
      if (!token) {
        try {
          // Try to access health endpoint without token
          // If server allows (localhost), this will succeed
          await apiClient.getHealth();
          setIsAuthenticated(true);
        } catch (error) {
          // Auth is required
          setIsAuthenticated(false);
        }
      } else {
        // Token exists, verify it
        try {
          await apiClient.getHealth();
          setIsAuthenticated(true);
        } catch (error) {
          // Token invalid, clear it
          apiClient.setAuthToken(null);
          setIsAuthenticated(false);
        }
      }

      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (token: string): Promise<boolean> => {
    try {
      apiClient.setAuthToken(token);
      // Verify the token works
      await apiClient.getHealth();
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      apiClient.setAuthToken(null);
      setIsAuthenticated(false);
      return false;
    }
  };

  const logout = () => {
    apiClient.setAuthToken(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
