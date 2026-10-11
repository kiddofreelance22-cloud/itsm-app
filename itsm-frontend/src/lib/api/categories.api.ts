import { apiFetch } from "./client";
import { Category } from "@/types/admin";

export interface CreateCategoryDto {
  categoryName: string;
  categoryCode?: string;
  description?: string;
  parentCategoryId?: number;
  displayOrder?: number;
  icon?: string;
  isActive?: boolean;
  availableInPortal?: boolean;
  availableInMobile?: boolean;
  showInCatalog?: boolean;
  allowInIncident?: boolean;
  /** Assignment group incidents in this category (or descendants that don't override it) route to. Omit/0 to inherit from the parent. */
  defaultAssignmentGroupId?: number;
  /** Optional scope overrides — omit/empty to inherit from the parent node. */
  workgroupIds?: number[];
  locationIds?: number[];
  memberIds?: number[];
}

export type CategoryDeletePolicy = "cascade" | "reparent";

export const CategoriesApi = {
  list: () => apiFetch<Category[]>("/categories"),
  /** Full, deeply-nested tree in one atomic payload. */
  tree: () => apiFetch<Category[]>("/categories/tree"),
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
  /**
   * `policy` controls what happens to child nodes:
   *  - "reparent" (default): children shift up one level onto this node's parent.
   *  - "cascade": the node and everything nested under it is removed.
   */
  remove: (id: number, policy: CategoryDeletePolicy = "reparent") =>
    apiFetch<void>(`/categories/${id}?policy=${policy}`, { method: "DELETE" }),
};
