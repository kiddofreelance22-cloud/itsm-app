import { apiFetch } from "./client";

export interface Department {
  departmentId: number;
  departmentName: string;
  departmentCode: string;
  description?: string;
  isActive: boolean;
  availableInPortal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentDto {
  departmentName: string;
  departmentCode: string;
  description?: string;
  isActive?: boolean;
  availableInPortal?: boolean;
}

export interface UpdateDepartmentDto {
  departmentName?: string;
  departmentCode?: string;
  description?: string;
  isActive?: boolean;
  availableInPortal?: boolean;
}

export const DepartmentsApi = {
  list: () => apiFetch<Department[]>("/departments"),
  getOne: (id: number) => apiFetch<Department>(`/departments/${id}`),
  create: (body: CreateDepartmentDto) =>
    apiFetch<Department>("/departments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: number, body: UpdateDepartmentDto) =>
    apiFetch<Department>(`/departments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: number) =>
    apiFetch<void>(`/departments/${id}`, { method: "DELETE" }),
};
