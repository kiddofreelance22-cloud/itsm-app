import { apiFetch } from "./client";
import { AdminUser } from "@/types/admin";

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  isActive?: boolean;
}

export interface UpdateUserDto {
  username?: string;
  email?: string;
  password?: string;
  fullName?: string;
  phone?: string;
  isActive?: boolean;
}

export const UsersApi = {
  list: () => apiFetch<AdminUser[]>("/users"),
  getOne: (id: number) => apiFetch<AdminUser>(`/users/${id}`),
  create: (body: CreateUserDto) =>
    apiFetch<AdminUser>("/users", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: number, body: UpdateUserDto) =>
    apiFetch<AdminUser>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: number) =>
    apiFetch<void>(`/users/${id}`, { method: "DELETE" }),
  deactivate: (id: number) =>
    apiFetch<AdminUser>(`/users/${id}/deactivate`, { method: "PATCH" }),
};
