import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  devVerificationToken: string | null;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, name: string, pass: string, confirmPass?: string) => Promise<string | undefined>;
  verifyEmail: (token: string) => Promise<string>;
  resendVerification: (email?: string) => Promise<{ message: string; devVerificationToken?: string }>;
  quickVerify: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string; devResetToken?: string }>;
  resetPassword: (token: string, newPass: string) => Promise<string>;
  logout: () => void;
  clearError: () => void;
  clearDevVerificationToken: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(api.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [devVerificationToken, setDevVerificationToken] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);
  const clearDevVerificationToken = useCallback(() => setDevVerificationToken(null), []);

  const refreshUser = useCallback(async () => {
    try {
      setIsLoading(true);
      // Validates session via HttpOnly cookie or Authorization header
      const res = await api.getMe();
      setUser(res.user);
      setToken(api.getToken());
    } catch {
      setUser(null);
      setToken(null);
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
      setToken(res.token);
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
  ): Promise<string | undefined> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.register(email, name, pass, confirmPass);
      setUser(res.user);
      setToken(res.token);
      if (res.devVerificationToken) {
        setDevVerificationToken(res.devVerificationToken);
      }
      return res.devVerificationToken;
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
      setDevVerificationToken(null);
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
      if (res.devVerificationToken) {
        setDevVerificationToken(res.devVerificationToken);
      }
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend verification email';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const quickVerify = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.quickVerify();
      setUser(res.user);
      setDevVerificationToken(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Quick verification failed';
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

  const logout = () => {
    api.logout();
    setUser(null);
    setToken(null);
    setError(null);
    setDevVerificationToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        error,
        devVerificationToken,
        login,
        register,
        verifyEmail,
        resendVerification,
        quickVerify,
        forgotPassword,
        resetPassword,
        logout,
        clearError,
        clearDevVerificationToken,
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
