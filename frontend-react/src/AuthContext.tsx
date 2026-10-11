"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ApiError, getToken, setToken } from "./api";
import { incidentApi } from "./incidentApi";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string, remember?: boolean) => Promise<void>;
  resetTemporaryPassword: (email: string, temporaryPassword: string, newPassword: string) => Promise<void>;
  ssoLogin: (code: string) => Promise<void>;
  clearError: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    incidentApi
      .currentUser()
      .then((res) => setUser(res.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string, remember = true) => {
    setError(null);
    try {
      const res = await incidentApi.login(username, password);
      setToken(res.token, remember);
      setUser(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      throw err;
    }
  }, []);

  const ssoLogin = useCallback(async (code: string) => {
    setError(null);
    try {
      const res = await incidentApi.ssoExchange(code);
      setToken(res.token, true);
      setUser(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      throw err;
    }
  }, []);

  const resetTemporaryPassword = useCallback(async (email: string, temporaryPassword: string, newPassword: string) => {
    setError(null);
    try {
      const res = await incidentApi.resetTemporaryPassword(email, temporaryPassword, newPassword);
      setToken(res.token);
      setUser(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      throw err;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, ssoLogin, resetTemporaryPassword, clearError, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
