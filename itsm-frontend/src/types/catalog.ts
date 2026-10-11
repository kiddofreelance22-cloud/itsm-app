import type { WorkflowStep, WorkflowTransition } from "./workflow";

export interface Catalog {
  catalogId: number;
  catalogName: string;
  catalogCode?: string;
  shortDescription?: string;
  description?: string;
  categoryId?: number;
  serviceCategoryId?: number;
  subCategoryId?: number;
  itemType?: string;
  isActive: boolean;
  allowRequestedFor: boolean;
  iconUrl?: string;
  bannerUrl?: string;
  tileColor?: string;
  catalogTypeId?: number;
  requestType?: string;
  approvalRequired?: boolean;
  stage?: string;
  priorityId?: number;
  impactId?: number;
  urgencyId?: number;
  slaName?: string;
  tags?: string[];
  keywords?: string;
  enableBulkSrCreation?: boolean;
  linkToOtherCategoryId?: number;
  status?: string;
  visibility?: string;
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
  formLayout?: "single" | "two-column" | string;
  createdAt?: string;
  updatedAt?: string;
  category?: Category;
  serviceCategory?: ServiceCategory;
  subCategory?: SubCategory;
  priority?: Priority;
  impact?: Impact;
  urgency?: Urgency;
  workflow?: Workflow;
  fulfillmentWorkflow?: Workflow;
  fulfillmentGroup?: AssignmentGroup;
  assignmentGroup?: AssignmentGroup;
  catalogType?: CatalogType;
  linkToOtherCategory?: Category;
  variables?: CatalogVariable[];
  sections?: CatalogFormSection[];
  attachments?: CatalogAttachment[];
}

export interface CatalogType {
  catalogTypeId: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogVariable {
  variableId: number;
  catalogId: number;
  sectionId?: number;
  sectionName?: string;
  label: string;
  fieldType: CatalogVariableFieldType;
  isMandatory: boolean;
  defaultValue?: string;
  placeholder?: string;
  helpText?: string;
  isVisible: boolean;
  readOnly: boolean;
  sortOrder: number;
  isActive: boolean;
  minValue?: string;
  maxValue?: string;
  validationRegex?: string;
  dateMin?: string;
  dateMax?: string;
  allowedFileTypes?: string;
  maxFileSizeMb?: number;
  lookupSource?: string;
  size?: string;
  tooltipText?: string;
  onlyIntegers?: boolean;
  updateBy?: string;
  isUnique?: boolean;
  displayInEmail?: boolean;
  autoPopulate?: boolean;
  options?: CatalogVariableOption[];
  section?: CatalogFormSection;
}

export type CatalogVariableFieldType =
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

export type FieldType = CatalogVariableFieldType;

export interface CatalogVariableOption {
  optionId: number;
  variableId: number;
  optionLabel: string;
  optionValue: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CatalogFormSection {
  sectionId: number;
  catalogId: number;
  name: string;
  description?: string;
  displayOrder: number;
  createdAt: string;
  variables?: CatalogVariable[];
}

export interface CatalogAttachment {
  attachmentId: number;
  catalogId: number;
  fileName: string;
  contentType?: string;
  size: number;
  storagePath: string;
  createdById?: number;
  createdBy?: { username: string };
  createdAt: string;
}

export interface FormTemplate {
  formTemplateId: number;
  name: string;
  description?: string;
  templateType: "group" | "form";
  templateData: Record<string, unknown>;
  createdById?: number;
  createdAt: string;
  updatedAt: string;
}

// Supporting interfaces
export interface Category {
  categoryId: number;
  categoryName: string;
  description?: string;
  parentCategoryId?: number;
  parent?: Category;
}

export interface ServiceCategory {
  serviceCategoryId: number;
  categoryName: string;
  description?: string;
  parentCategoryId?: number;
  imageUrl?: string;
  tileColor?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface SubCategory {
  subCategoryId: number;
  subCategoryName: string;
  description?: string;
  categoryId?: number;
}

export interface Priority {
  priorityId: number;
  priorityName: string;
  sortOrder?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface Impact {
  impactId: number;
  impactName: string;
  sortOrder?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface Urgency {
  urgencyId: number;
  urgencyName: string;
  sortOrder?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface AssignmentGroup {
  groupId: number;
  groupName: string;
  description?: string;
  departmentId?: number;
}

export interface Workflow {
  workflowId: number;
  workflowName: string;
  description?: string;
  isActive: boolean;
  status?: string;
  version?: number;
  associatedCatalogId?: number;
  requiresApproval?: boolean;
  approverRoleId?: number;
  steps?: WorkflowStep[];
  transitions?: WorkflowTransition[];
  createdAt?: string;
  updatedAt?: string;
}
