"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ApiError, getToken, setToken } from "./api";
import { clearSession, incidentApi } from "./incidentApi";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string, remember?: boolean) => Promise<void>;
  resetTemporaryPassword: (email: string, temporaryPassword: string, newPassword: string) => Promise<void>;
  ssoLogin: (code: string) => Promise<void>;
  switchUser: (userId: number) => Promise<void>;
  extendSupportSession: () => Promise<void>;
  stopSwitching: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  clearError: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);
const ORIGINAL_TOKEN_KEY = "meridian_support_original_token";
const ORIGINAL_REMEMBER_KEY = "meridian_support_original_remember";

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

  const switchUser = useCallback(async (userId: number) => {
    const originalToken = getToken();
    if (!originalToken) throw new Error("Your administrator session has expired. Sign in again.");
    setError(null);
    try {
      const remember = (() => {
        try { return localStorage.getItem("meridian_token") === originalToken; } catch { return false; }
      })();
      sessionStorage.setItem(ORIGINAL_TOKEN_KEY, originalToken);
      sessionStorage.setItem(ORIGINAL_REMEMBER_KEY, String(remember));
      const res = await incidentApi.switchUser(userId);
      setToken(res.token, remember);
      setUser(res.user);
    } catch (err) {
      try {
        sessionStorage.removeItem(ORIGINAL_TOKEN_KEY);
        sessionStorage.removeItem(ORIGINAL_REMEMBER_KEY);
      } catch {}
      setError(err instanceof ApiError ? err.message : "Could not switch users.");
      throw err;
    }
  }, []);

  const extendSupportSession = useCallback(async () => {
    setError(null);
    try {
      const remember = (() => {
        try { return localStorage.getItem("meridian_token") === getToken(); } catch { return false; }
      })();
      const res = await incidentApi.extendImpersonation();
      setToken(res.token, remember);
      setUser(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not extend the support session.");
      throw err;
    }
  }, []);

  const stopSwitching = useCallback(async () => {
    const originalToken = sessionStorage.getItem(ORIGINAL_TOKEN_KEY);
    const remember = sessionStorage.getItem(ORIGINAL_REMEMBER_KEY) === "true";
    if (!originalToken || !user?.impersonationId) throw new Error("The original administrator session is unavailable. Sign in again.");
    const supportToken = getToken();
    setError(null);
    setToken(originalToken, remember);
    try {
      await incidentApi.endImpersonation(user.impersonationId);
      const res = await incidentApi.currentUser();
      sessionStorage.removeItem(ORIGINAL_TOKEN_KEY);
      sessionStorage.removeItem(ORIGINAL_REMEMBER_KEY);
      setUser(res.user);
    } catch (err) {
      setToken(supportToken, remember);
      setError(err instanceof ApiError ? err.message : "Could not end the support session.");
      throw err;
    }
  }, [user?.impersonationId]);

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

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((current) => current ? { ...current, ...updates } : current);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    try {
      sessionStorage.removeItem(ORIGINAL_TOKEN_KEY);
      sessionStorage.removeItem(ORIGINAL_REMEMBER_KEY);
    } catch {}
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, ssoLogin, switchUser, extendSupportSession, stopSwitching, resetTemporaryPassword, updateUser, clearError, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
