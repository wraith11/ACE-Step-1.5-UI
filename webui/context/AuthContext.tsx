import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authApi, User } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setupUser: (username: string) => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'acestep_token';
const USER_KEY = 'acestep_user';

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!token;

  useEffect(() => {
    async function initAuth(): Promise<void> {
      try {
        const { user: userData, token: newToken } = await authApi.auto();
        setUser(userData);
        setToken(newToken);
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
      } catch (error: unknown) {
        const err = error as { message?: string };
        if (err.message?.startsWith('404:')) {
          console.log('No user in database, need to set up username');
        } else {
          console.warn('Auto-login failed:', error);
        }
        setToken(null);
        setUser(null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

  const setupUser = useCallback(async (username: string): Promise<void> => {
    const { user: userData, token: newToken } = await authApi.setup(username);
    setUser(userData);
    setToken(newToken);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  }, []);

  const updateUsername = useCallback(async (username: string): Promise<void> => {
    if (!token) throw new Error('Not authenticated');
    const { user: userData, token: newToken } = await authApi.updateUsername(username, token);
    setUser(userData);
    setToken(newToken);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  }, [token]);

  const logout = useCallback((): void => {
    authApi.logout().catch(() => {});
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      const { user: userData } = await authApi.me(token);
      setUser(userData);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, [token]);

  const value: AuthContextType = {
    user, token, isLoading, isAuthenticated, setupUser, updateUsername, logout, refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within AuthProvider');
  return context;
}