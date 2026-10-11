import { apiFetch } from "./client";
import { Catalog, CatalogVariable, CatalogFormSection, CatalogAttachment } from "@/types/catalog";

export interface CreateCatalogDto {
  catalogName: string;
  catalogCode?: string;
  shortDescription?: string;
  description?: string;
  categoryId?: number;
  serviceCategoryId?: number;
  itemType?: string;
  iconUrl?: string;
  bannerUrl?: string;
  isActive?: boolean;
  allowRequestedFor?: boolean;
  requestType?: string;
  approvalRequired?: boolean;
  stage?: string;
  priorityId?: number;
  impactId?: number;
  urgencyId?: number;
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
  showSectionNumbers?: boolean;
  showProgressIndicator?: boolean;
  collapseAllSections?: boolean;
  makeFieldsMandatory?: boolean;
  formLayout?: "single" | "two-column";
}

export interface CreateVariableDto {
  sectionId?: number;
  label: string;
  fieldType: string;
  isMandatory?: boolean;
  defaultValue?: string;
  placeholder?: string;
  helpText?: string;
  sortOrder?: number;
  isVisible?: boolean;
  readOnly?: boolean;
  minValue?: string;
  maxValue?: string;
  validationRegex?: string;
  dateMin?: string;
  dateMax?: string;
  allowedFileTypes?: string;
  maxFileSizeMb?: number;
  lookupSource?: string;
  options?: { optionLabel: string; optionValue: string; sortOrder?: number }[];
}

export interface CreateSectionDto {
  name: string;
  description?: string;
  displayOrder?: number;
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

  // Variables
  getVars:    (id: number) =>
    apiFetch<CatalogVariable[]>(`/catalogs/${id}/variables`),
  createVar:  (id: number, body: CreateVariableDto) =>
    apiFetch<CatalogVariable>(`/catalogs/${id}/variables`, { method: "POST", body: JSON.stringify(body) }),
  updateVar:  (id: number, vid: number, body: Partial<CreateVariableDto>) =>
    apiFetch<CatalogVariable>(`/catalogs/${id}/variables/${vid}`, { method: "PATCH", body: JSON.stringify(body) }),
  removeVar:  (id: number, vid: number) =>
    apiFetch<void>(`/catalogs/${id}/variables/${vid}`, { method: "DELETE" }),
  reorderVars: (id: number, variables: { variableId: number; sortOrder: number; sectionId?: number | null }[]) =>
    apiFetch<CatalogVariable[]>(`/catalogs/${id}/variables/reorder`, { method: "PATCH", body: JSON.stringify({ variables }) }),

  // Sections
  getSections: (id: number) =>
    apiFetch<CatalogFormSection[]>(`/catalogs/${id}/sections`),
  createSection: (id: number, body: CreateSectionDto) =>
    apiFetch<CatalogFormSection>(`/catalogs/${id}/sections`, { method: "POST", body: JSON.stringify(body) }),
  updateSection: (id: number, sectionId: number, body: Partial<CreateSectionDto>) =>
    apiFetch<CatalogFormSection>(`/catalogs/${id}/sections/${sectionId}`, { method: "PATCH", body: JSON.stringify(body) }),
  removeSection: (id: number, sectionId: number) =>
    apiFetch<void>(`/catalogs/${id}/sections/${sectionId}`, { method: "DELETE" }),
  reorderSections: (id: number, sections: { sectionId: number; displayOrder: number }[]) =>
    apiFetch<CatalogFormSection[]>(`/catalogs/${id}/sections/reorder`, { method: "PATCH", body: JSON.stringify({ sections }) }),

  // Attachments
  getAttachments: (id: number) =>
    apiFetch<CatalogAttachment[]>(`/catalogs/${id}/attachments`),
  createAttachment: (id: number, body: { fileName: string; contentType?: string; size: number; storagePath: string }) =>
    apiFetch<CatalogAttachment>(`/catalogs/${id}/attachments`, { method: "POST", body: JSON.stringify(body) }),
  removeAttachment: (id: number, attachmentId: number) =>
    apiFetch<void>(`/catalogs/${id}/attachments/${attachmentId}`, { method: "DELETE" }),
};
