import { apiFetch } from "./client";

export interface LoginResponse {
  accessToken: string;
  user: {
    userId: number;
    username: string;
    email: string;
    fullName: string;
    phone?: string;
    roles: string[];
    isFirstLogin?: boolean;
  };
}

export const AuthApi = {
  login: (username: string, password: string) =>
    apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  me: () =>
    apiFetch<LoginResponse["user"]>("/auth/me"),

  resetTempPassword: (email: string, temporaryPassword: string, newPassword: string) =>
    apiFetch<LoginResponse>("/auth/reset-temp-password", {
      method: "POST",
      body: JSON.stringify({ email, temporaryPassword, newPassword }),
    }),
};
