import React, { createContext, useCallback, useEffect, useState } from 'react';
import { User } from '../types';
import { authApi, LoginPayload, RegisterPayload } from '../api/authApi';
import { extractErrorMessage } from '../api/apiClient';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  // Tracks whether the initial silent-session-restore (via the refresh
  // cookie) has finished, so the UI can show a loading state instead of
  // briefly flashing the login page for an already-authenticated user.
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession(): Promise<void> {
      try {
        const restoredUser = await authApi.bootstrapSession();
        if (isMounted) setUser(restoredUser);
      } catch {
        // No valid refresh cookie present — user is simply logged out.
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    }

    void restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const loggedInUser = await authApi.login(payload);
    setUser(loggedInUser);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const newUser = await authApi.register(payload);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Even if the network call fails, clear local state so the user is
      // not stuck "logged in" on a broken connection.
      console.warn('Logout request failed:', extractErrorMessage(error));
    } finally {
      setUser(null);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isInitializing,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
