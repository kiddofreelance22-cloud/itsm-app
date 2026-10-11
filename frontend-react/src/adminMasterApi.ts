import { api } from "./api";

export interface AdminCategory {
  categoryId: number;
  categoryName: string;
  categoryCode?: string;
  description?: string;
  parentCategoryId?: number | null;
  parent?: { categoryId: number; categoryName: string } | null;
  isActive?: boolean;
}

export interface AdminSubCategory {
  subCategoryId: number;
  subCategoryName: string;
  subCategoryCode: string;
  description?: string;
  category?: { categoryId: number; categoryName: string } | null;
  categoryId?: number | null;
  isActive: boolean;
}

export interface AdminStatus {
  statusId: number;
  statusName: string;
  statusCode: string;
  type: string;
  isOpen: boolean;
  isActive: boolean;
}

export interface AdminAssignmentGroup {
  groupId: number;
  groupName: string;
  groupCode: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface AdminNamedMaster {
  closureCodeId?: number;
  closureCodeName?: string;
  pendingReasonId?: number;
  pendingReasonName?: string;
  isActive: boolean;
}

type MasterPayload = Record<string, unknown>;

export const adminMasterApi = {
  list: <T>(endpoint: string) => api.get<T[]>(endpoint),
  get: <T>(endpoint: string) => api.get<T>(endpoint),
  create: <T>(endpoint: string, data?: Record<string, unknown>) => api.post<T>(endpoint, data),
  update: <T>(endpoint: string, id: number, data: Record<string, unknown>) => api.patch<T>(`${endpoint}/${id}`, data),
  remove: <T>(endpoint: string, id: number) => api.delete<T>(`${endpoint}/${id}${endpoint === "/categories" ? "?policy=reparent" : ""}`),

  categories: () => api.get<AdminCategory[]>("/categories"),
  createCategory: (data: MasterPayload) => api.post<AdminCategory>("/categories", data),
  updateCategory: (id: number, data: MasterPayload) => api.patch<AdminCategory>(`/categories/${id}`, data),
  deleteCategory: (id: number) => api.delete<void>(`/categories/${id}?policy=reparent`),

  subCategories: () => api.get<AdminSubCategory[]>("/sub-category"),
  createSubCategory: (data: MasterPayload) => api.post<AdminSubCategory>("/sub-category", data),
  updateSubCategory: (id: number, data: MasterPayload) => api.patch<AdminSubCategory>(`/sub-category/${id}`, data),
  deleteSubCategory: (id: number) => api.delete<void>(`/sub-category/${id}`),

  statuses: () => api.get<AdminStatus[]>("/status"),
  createStatus: (data: MasterPayload) => api.post<AdminStatus>("/status", data),
  updateStatus: (id: number, data: MasterPayload) => api.patch<AdminStatus>(`/status/${id}`, data),
  deleteStatus: (id: number) => api.delete<void>(`/status/${id}`),

  assignmentGroups: () => api.get<AdminAssignmentGroup[]>("/assignment-groups"),
  createAssignmentGroup: (data: MasterPayload) => api.post<AdminAssignmentGroup>("/assignment-groups", data),
  updateAssignmentGroup: (id: number, data: MasterPayload) => api.patch<AdminAssignmentGroup>(`/assignment-groups/${id}`, data),
  deleteAssignmentGroup: (id: number) => api.delete<void>(`/assignment-groups/${id}`),

  closureCodes: () => api.get<AdminNamedMaster[]>("/closure-codes"),
  createClosureCode: (data: MasterPayload) => api.post<AdminNamedMaster>("/closure-codes", data),
  updateClosureCode: (id: number, data: MasterPayload) => api.patch<AdminNamedMaster>(`/closure-codes/${id}`, data),
  deleteClosureCode: (id: number) => api.delete<void>(`/closure-codes/${id}`),

  pendingReasons: () => api.get<AdminNamedMaster[]>("/pending-reasons"),
  createPendingReason: (data: MasterPayload) => api.post<AdminNamedMaster>("/pending-reasons", data),
  updatePendingReason: (id: number, data: MasterPayload) => api.patch<AdminNamedMaster>(`/pending-reasons/${id}`, data),
  deletePendingReason: (id: number) => api.delete<void>(`/pending-reasons/${id}`),
};