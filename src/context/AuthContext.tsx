import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, name: string, pass: string, confirmPass?: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<string>;
  resendVerification: (email?: string) => Promise<{ message: string }>;
  forgotPassword: (email: string) => Promise<{ message: string }>;
  resetPassword: (token: string, newPass: string) => Promise<string>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const refreshUser = useCallback(async () => {
    try {
      setIsLoading(true);
      // Validates session via HttpOnly cookie
      const res = await api.getMe();
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.login(email, pass);
      setUser(res.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string,
    name: string,
    pass: string,
    confirmPass?: string
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.register(email, name, pass, confirmPass);
      setUser(res.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEmail = async (vToken: string): Promise<string> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.verifyEmail(vToken);
      if (res.user) {
        setUser((prev) => (prev ? { ...prev, emailVerified: true } : res.user || null));
      }
      return res.message;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Email verification failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerification = async (email?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.resendVerification(email || user?.email);
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend verification email';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await api.forgotPassword(email);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset request failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (resetToken: string, newPass: string): Promise<string> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.resetPassword(resetToken, newPass);
      return res.message;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await api.logout();
    } catch (err: unknown) {
      console.error('Logout failed:', err);
    } finally {
      setUser(null);
      setError(null);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        register,
        verifyEmail,
        resendVerification,
        forgotPassword,
        resetPassword,
        logout,
        clearError,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
