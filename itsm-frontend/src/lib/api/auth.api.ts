import { apiFetch } from "./client";

export interface LoginResponse {
  accessToken: string;
  user: {
    userId: number;
    username: string;
    email: string;
    fullName: string;
    profilePhotoUrl?: string;
    phone?: string;
    roles: string[];
    permissions: string[];
    isFirstLogin?: boolean;
  };
}

export type SsoProvider = "google" | "microsoft";

export const AuthApi = {
  login: (username: string, password: string) =>
    apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  me: () =>
    apiFetch<LoginResponse["user"]>("/auth/me"),

  ssoProviders: () =>
    apiFetch<{ providers: SsoProvider[] }>("/auth/sso/providers"),

  exchangeSsoCode: (code: string) =>
    apiFetch<LoginResponse>("/auth/sso/exchange", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  resetTempPassword: (email: string, temporaryPassword: string, newPassword: string) =>
    apiFetch<LoginResponse>("/auth/reset-temp-password", {
      method: "POST",
      body: JSON.stringify({ email, temporaryPassword, newPassword }),
    }),
};
