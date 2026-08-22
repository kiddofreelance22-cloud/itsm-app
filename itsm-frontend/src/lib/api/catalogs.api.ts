import { apiFetch } from "./client";
import { Catalog, CatalogVariable } from "@/types/catalog";

export interface CreateCatalogDto {
  catalogName: string;
  catalogCode?: string;
  shortDescription?: string;
  description?: string;
  categoryId?: number;
  subCategory?: string;
  itemType?: string;
  iconUrl?: string;
  bannerUrl?: string;
  isActive?: boolean;
  allowRequestedFor?: boolean;
  requestType?: string;
  approvalRequired?: boolean;
  stage?: string;
  impact?: string;
  urgency?: string;
  defaultPriority?: string;
  slaName?: string;
  tags?: string[];
  keywords?: string;
  serviceOffering?: string;
  businessService?: string;
  configurationItem?: string;
  estimatedTime?: number;
  deliveryTimeSla?: number;
  hidePrice?: boolean;
  workflowId?: number;
  approvalPolicy?: string;
  fulfillmentWorkflowId?: number;
  fulfillmentGroupId?: number;
  assignmentGroupId?: number;
  availableInPortal?: boolean;
  availableInMobile?: boolean;
  showInCatalog?: boolean;
  showInPopular?: boolean;
  requiresApprovalFor?: boolean;
  allowRequestsForOthers?: boolean;
  enableDiscussion?: boolean;
  visibleTo?: string;
  userGroups?: string[];
  departments?: string[];
  locations?: string[];
}

export interface CreateVariableDto {
  sectionName?: string;
  label: string;
  fieldType: string;
  isMandatory?: boolean;
  defaultValue?: string;
  placeholder?: string;
  helpText?: string;
  displayOrder?: number;
  sortOrder?: number;
  isVisible?: boolean;
  readOnly?: boolean;
  options?: { optionLabel: string; optionValue: string; sortOrder?: number }[];
}

export const CatalogsApi = {
  listActive: () => apiFetch<Catalog[]>("/catalogs"),
  listAll:    () => apiFetch<Catalog[]>("/catalogs?active=false"),
  getOne:     (id: number) => apiFetch<Catalog>(`/catalogs/${id}`),
  create:     (body: CreateCatalogDto) =>
    apiFetch<Catalog>("/catalogs", { method: "POST", body: JSON.stringify(body) }),
  update:     (id: number, body: Partial<CreateCatalogDto>) =>
    apiFetch<Catalog>(`/catalogs/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove:     (id: number) =>
    apiFetch<void>(`/catalogs/${id}`, { method: "DELETE" }),
  getVars:    (id: number) =>
    apiFetch<CatalogVariable[]>(`/catalogs/${id}/variables`),
  createVar:  (id: number, body: CreateVariableDto) =>
    apiFetch<CatalogVariable>(`/catalogs/${id}/variables`, { method: "POST", body: JSON.stringify(body) }),
  updateVar:  (id: number, vid: number, body: Partial<CreateVariableDto>) =>
    apiFetch<CatalogVariable>(`/catalogs/${id}/variables/${vid}`, { method: "PATCH", body: JSON.stringify(body) }),
  removeVar:  (id: number, vid: number) =>
    apiFetch<void>(`/catalogs/${id}/variables/${vid}`, { method: "DELETE" }),
};