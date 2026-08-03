import { apiFetch } from "./client";
import { Category } from "@/types/admin";

export interface CreateCategoryDto {
  categoryName: string;
  description?: string;
  parentCategoryId?: number;
  isActive?: boolean;
}

export const CategoriesApi = {
  list: () => apiFetch<Category[]>("/categories"),
  getOne: (id: number) => apiFetch<Category>(`/categories/${id}`),
  create: (body: CreateCategoryDto) =>
    apiFetch<Category>("/categories", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: number, body: Partial<CreateCategoryDto>) =>
    apiFetch<Category>(`/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: number) =>
    apiFetch<void>(`/categories/${id}`, { method: "DELETE" }),
};
