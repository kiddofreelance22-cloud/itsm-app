import { apiFetch } from "./client";
import { Role, Permission } from "@/types/admin";

export interface CreateRoleDto {
  roleName: string;
  roleCode?: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateRolePermissionsDto {
  permissionIds: number[];
}

export interface RolePermissionsResponse {
  role: Role;
  permissions: Permission[];
  permissionSummary: Record<string, number>;
}

export const RolesApi = {
  list: () => apiFetch<Role[]>("/roles"),
  
  get: (id: number) => apiFetch<Role>(`/roles/${id}`),
  
  create: (body: CreateRoleDto) =>
    apiFetch<Role>("/roles", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  
  update: (id: number, body: Partial<CreateRoleDto>) =>
    apiFetch<Role>(`/roles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  
  remove: (id: number) =>
    apiFetch<void>(`/roles/${id}`, { method: "DELETE" }),
  
  getPermissions: (roleId: number) =>
    apiFetch<RolePermissionsResponse>(`/roles/${roleId}/permissions`),

  getUsers: (roleId: number) =>
    apiFetch<{ userId: number; fullName: string; email: string; isActive: boolean }[]>(
      `/roles/${roleId}/users`
    ),
  
  updatePermissions: (roleId: number, body: UpdateRolePermissionsDto) =>
    apiFetch<{ role: Role; permissions: Permission[] }>(`/roles/${roleId}/permissions`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  
  getAllPermissions: () =>
    apiFetch<Record<string, Permission[]>>("/roles/admin/all-permissions"),
  
  assign: (userId: number, roleId: number) =>
    apiFetch<void>("/roles/assign", {
      method: "POST",
      body: JSON.stringify({ userId, roleId }),
    }),
  
  unassign: (userId: number, roleId: number) =>
    apiFetch<void>(`/roles/user/${userId}/role/${roleId}`, {
      method: "DELETE",
    }),
};
