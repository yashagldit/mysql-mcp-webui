import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../../api/client';

interface User {
  id: string;
  username: string;
  must_change_password: boolean;
}

interface LoginCredentials {
  username?: string;
  password?: string;
  token?: string;
}

interface LoginResult {
  success: boolean;
  error?: string;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const refreshUser = async () => {
    try {
      const response = await apiClient.get('/auth/me');
      if (response.data.success) {
        setUser(response.data.data);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    // Check if user is authenticated on mount
    const checkAuth = async () => {
      try {
        // Try to get current user (will use cookie if it exists)
        await refreshUser();
      } catch (error) {
        // Not authenticated
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials: LoginCredentials): Promise<LoginResult> => {
    try {
      const response = await apiClient.post('/auth/login', credentials);

      if (response.data.success) {
        const userData = response.data.data.user;

        if (userData) {
          // Username/password login - user object returned
          setUser(userData);
          setIsAuthenticated(true);
          return {
            success: true,
            mustChangePassword: userData.must_change_password,
          };
        } else {
          // API token login - no user object, just verification
          setIsAuthenticated(true);
          setUser(null);
          return { success: true };
        }
      } else {
        return {
          success: false,
          error: response.data.error || 'Login failed',
        };
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Authentication failed. Please try again.';
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Ignore logout errors
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout, refreshUser }}>
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
