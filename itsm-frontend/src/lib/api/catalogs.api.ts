import { apiFetch } from "./client";
import { Catalog, CatalogVariable } from "@/types/catalog";

export interface CreateCatalogDto {
  catalogName: string;
  shortDescription?: string;
  description?: string;
  categoryId: number;
  iconUrl?: string;
  workflowId?: number;
  isActive?: boolean;
}

export interface CreateVariableDto {
  label: string;
  fieldType: string;
  isMandatory?: boolean;
  defaultValue?: string;
  sortOrder?: number;
  options?: { optionLabel: string; optionValue: string }[];
}

export const CatalogsApi = {
  listActive: () => apiFetch<Catalog[]>("/catalogs"),
  listAll: () => apiFetch<Catalog[]>("/catalogs?active=false"),
  getOne: (id: number) => apiFetch<Catalog>(`/catalogs/${id}`),
  create: (body: CreateCatalogDto) =>
    apiFetch<Catalog>("/catalogs", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: number, body: Partial<CreateCatalogDto>) =>
    apiFetch<Catalog>(`/catalogs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: number) =>
    apiFetch<void>(`/catalogs/${id}`, { method: "DELETE" }),

  // Variables sub-resource
  getVars: (id: number) =>
    apiFetch<CatalogVariable[]>(`/catalogs/${id}/variables`),
  createVar: (id: number, body: CreateVariableDto) =>
    apiFetch<CatalogVariable>(`/catalogs/${id}/variables`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateVar: (id: number, vid: number, body: Partial<CreateVariableDto>) =>
    apiFetch<CatalogVariable>(`/catalogs/${id}/variables/${vid}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  removeVar: (id: number, vid: number) =>
    apiFetch<void>(`/catalogs/${id}/variables/${vid}`, { method: "DELETE" }),
};
