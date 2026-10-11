import { api } from "./api";

export interface CatalogVariableOption {
  optionId: number;
  optionLabel: string;
  optionValue: string;
  sortOrder: number;
}

export interface CatalogSection {
  sectionId: number;
  name: string;
  description?: string | null;
  displayOrder: number;
}

export interface ServiceCatalogCategory {
  serviceCategoryId: number;
  categoryName: string;
  isActive?: boolean;
}

export interface CatalogVariable {
  variableId: number;
  label: string;
  fieldType:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "datetime"
    | "dropdown"
    | "multi_select"
    | "checkbox"
    | "radio"
    | "attachment"
    | "user_lookup"
    | "group_lookup"
    | "info";
  isMandatory: boolean;
  defaultValue?: string | null;
  placeholder?: string | null;
  helpText?: string | null;
  tooltipText?: string | null;
  isVisible: boolean;
  readOnly: boolean;
  isActive: boolean;
  sortOrder: number;
  validationRegex?: string | null;
  sectionName?: string | null;
  section?: { sectionId?: number; name: string; displayOrder?: number } | null;
  minValue?: string | null;
  maxValue?: string | null;
  dateMin?: string | null;
  dateMax?: string | null;
  allowedFileTypes?: string | null;
  maxFileSizeMb?: number | null;
  lookupSource?: string | null;
  onlyIntegers?: boolean;
  options?: CatalogVariableOption[];
}

export interface CatalogAttachment {
  attachmentId: number;
  fileName: string;
  contentType?: string | null;
  size: number;
  storagePath: string;
  createdAt: string;
  createdBy?: { username?: string } | null;
}

export interface CatalogWorkflow {
  workflowId: number;
  workflowName: string;
  isActive?: boolean;
  status?: string;
}

export interface CatalogLookupItem {
  priorityId?: number;
  priorityName?: string;
  impactId?: number;
  impactName?: string;
  urgencyId?: number;
  urgencyName?: string;
  groupId?: number;
  groupName?: string;
}

export interface ServiceCatalog {
  catalogId: number;
  catalogName: string;
  catalogCode?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  tileColor?: string | null;
  isActive?: boolean;
  allowRequestedFor?: boolean;
  itemType?: string;
  requestType?: string;
  approvalRequired?: boolean;
  stage?: string;
  slaName?: string | null;
  tags?: string[] | null;
  keywords?: string | null;
  serviceOffering?: string | null;
  businessService?: string | null;
  configurationItem?: string | null;
  hidePrice?: boolean;
  workflowId?: number;
  approvalPolicy?: string | null;
  fulfillmentWorkflowId?: number;
  fulfillmentGroupId?: number;
  assignmentGroupId?: number;
  availableInPortal?: boolean;
  availableInMobile?: boolean;
  showInCatalog?: boolean;
  status?: string;
  createdAt?: string;
  showInPopular?: boolean;
  visibility?: "public" | "internal" | "private";
  requiresApprovalFor?: boolean;
  allowRequestsForOthers?: boolean;
  enableDiscussion?: boolean;
  visibleTo?: string;
  userGroups?: string[] | null;
  departments?: string[] | null;
  locations?: string[] | null;
  showSectionNumbers?: boolean;
  showProgressIndicator?: boolean;
  collapseAllSections?: boolean;
  makeFieldsMandatory?: boolean;
  category?: { categoryName?: string } | null;
  serviceCategory?: ServiceCatalogCategory | null;
  workflow?: CatalogWorkflow | null;
  fulfillmentWorkflow?: CatalogWorkflow | null;
  fulfillmentGroup?: { groupId: number; groupName: string } | null;
  assignmentGroup?: { groupId: number; groupName: string } | null;
  priority?: { priorityId: number; priorityName: string } | null;
  impact?: { impactId: number; impactName: string } | null;
  urgency?: { urgencyId: number; urgencyName: string } | null;
  estimatedTime?: number | null;
  deliveryTimeSla?: number | null;
  formLayout?: string | null;
  variables?: CatalogVariable[];
  sections?: CatalogSection[];
  attachments?: CatalogAttachment[];
}

export interface ServiceRequest {
  requestId: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  catalog: { catalogId?: number; catalogName: string };
  requestedBy?: { userId?: number; fullName?: string } | null;
  currentStep?: { stepName?: string } | null;
  variableValues?: { variable: { variableId: number; label: string }; value: string }[];
}

export interface CreateServiceRequest {
  catalogId: number;
  variableValues: { variableId: number; value: string }[];
}

export interface UploadedRequestFile {
  url: string;
  fileName: string;
  contentType: string;
  size: number;
}

export type CatalogFieldType = CatalogVariable["fieldType"];

export interface CatalogVariablePayload {
  sectionId?: number | null;
  label: string;
  fieldType: CatalogFieldType;
  isMandatory?: boolean;
  defaultValue?: string;
  placeholder?: string;
  helpText?: string;
  isVisible?: boolean;
  readOnly?: boolean;
  sortOrder?: number;
  minValue?: string;
  maxValue?: string;
  validationRegex?: string;
  dateMin?: string;
  dateMax?: string;
  allowedFileTypes?: string;
  maxFileSizeMb?: number;
  lookupSource?: string;
  onlyIntegers?: boolean;
  tooltipText?: string;
  options?: { optionLabel: string; optionValue: string; sortOrder?: number }[];
}

export interface CatalogPayload {
  catalogName: string;
  catalogCode?: string;
  shortDescription?: string;
  description?: string;
  serviceCategoryId?: number | null;
  isActive?: boolean;
  allowRequestedFor?: boolean;
  itemType?: string;
  requestType?: string;
  approvalRequired?: boolean;
  stage?: string;
  priorityId?: number | null;
  impactId?: number | null;
  urgencyId?: number | null;
  slaName?: string;
  tags?: string[];
  keywords?: string;
  serviceOffering?: string;
  businessService?: string;
  configurationItem?: string;
  hidePrice?: boolean;
  workflowId?: number | null;
  approvalPolicy?: string;
  fulfillmentWorkflowId?: number | null;
  fulfillmentGroupId?: number | null;
  assignmentGroupId?: number | null;
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
  status?: "draft" | "published" | "archived";
  visibility?: "public" | "internal" | "private";
  formLayout?: "single" | "two-column";
  estimatedTime?: number;
  deliveryTimeSla?: number;
  tileColor?: string;
  iconUrl?: string;
  bannerUrl?: string;
}

export const serviceRequestApi = {
  catalogs: () => api.get<ServiceCatalog[]>("/catalogs"),
  allCatalogs: () => api.get<ServiceCatalog[]>("/catalogs?active=false"),
  catalog: (id: number) => api.get<ServiceCatalog>(`/catalogs/${id}`),
  serviceCategories: () => api.get<ServiceCatalogCategory[]>("/service-categories"),
  workflows: () => api.get<CatalogWorkflow[]>("/workflows"),
  assignmentGroups: () => api.get<CatalogLookupItem[]>("/assignment-groups"),
  priorities: () => api.get<CatalogLookupItem[]>("/priority"),
  impacts: () => api.get<CatalogLookupItem[]>("/impact"),
  urgencies: () => api.get<CatalogLookupItem[]>("/urgency"),
  createCatalog: (body: CatalogPayload) => api.post<ServiceCatalog>("/catalogs", body),
  updateCatalog: (id: number, body: Partial<CatalogPayload>) => api.patch<ServiceCatalog>(`/catalogs/${id}`, body),
  deleteCatalog: (id: number) => api.delete<void>(`/catalogs/${id}`),
  createVariable: (catalogId: number, body: CatalogVariablePayload) => api.post<CatalogVariable>(`/catalogs/${catalogId}/variables`, body),
  updateVariable: (catalogId: number, variableId: number, body: Partial<CatalogVariablePayload>) => api.patch<CatalogVariable>(`/catalogs/${catalogId}/variables/${variableId}`, body),
  deleteVariable: (catalogId: number, variableId: number) => api.delete<void>(`/catalogs/${catalogId}/variables/${variableId}`),
  createSection: (catalogId: number, body: { name: string; description?: string; displayOrder?: number }) => api.post<CatalogSection>(`/catalogs/${catalogId}/sections`, body),
  updateSection: (catalogId: number, sectionId: number, body: { name?: string; description?: string; displayOrder?: number }) => api.patch<CatalogSection>(`/catalogs/${catalogId}/sections/${sectionId}`, body),
  deleteSection: (catalogId: number, sectionId: number) => api.delete<void>(`/catalogs/${catalogId}/sections/${sectionId}`),
  reorderSections: (catalogId: number, sections: { sectionId: number; displayOrder: number }[]) =>
    api.patch<CatalogSection[]>(`/catalogs/${catalogId}/sections/reorder`, { sections }),
  reorderVariables: (catalogId: number, variables: { variableId: number; sortOrder: number; sectionId?: number | null }[]) =>
    api.patch<CatalogVariable[]>(`/catalogs/${catalogId}/variables/reorder`, { variables }),
  catalogAttachments: (catalogId: number) => api.get<CatalogAttachment[]>(`/catalogs/${catalogId}/attachments`),
  createCatalogAttachment: (catalogId: number, body: { fileName: string; contentType?: string; size: number; storagePath: string }) =>
    api.post<CatalogAttachment>(`/catalogs/${catalogId}/attachments`, body),
  deleteCatalogAttachment: (catalogId: number, attachmentId: number) =>
    api.delete<void>(`/catalogs/${catalogId}/attachments/${attachmentId}`),
  mine: () => api.get<ServiceRequest[]>("/requests/mine"),
  all: () => api.get<ServiceRequest[]>("/requests"),
  get: (id: number) => api.get<ServiceRequest>(`/requests/${id}`),
  create: (body: CreateServiceRequest) => api.post<ServiceRequest>("/requests", body),
  createForUser: (requestedById: number, body: CreateServiceRequest) =>
    api.post<ServiceRequest>("/requests/admin", { ...body, requestedById }),
  update: (id: number, body: { variableValues: CreateServiceRequest["variableValues"]; comments?: string }) =>
    api.patch<ServiceRequest>(`/requests/${id}`, body),
  cancel: (id: number) => api.post<ServiceRequest>(`/requests/${id}/cancel`, {}),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<UploadedRequestFile>("/uploads", form);
  },
};
