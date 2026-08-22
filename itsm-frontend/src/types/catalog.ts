export type FieldType =
  | "text" | "textarea" | "number" | "date" | "datetime"
  | "dropdown" | "multi_select" | "checkbox" | "radio"
  | "attachment" | "user_lookup" | "group_lookup" | "info";

export interface CatalogVariableOption {
  optionId: number;
  optionLabel: string;
  optionValue: string;
  sortOrder: number;
}

export interface CatalogVariable {
  variableId: number;
  sectionName: string;
  label: string;
  fieldType: FieldType;
  isMandatory: boolean;
  defaultValue?: string | null;
  placeholder?: string | null;
  helpText?: string | null;
  displayOrder: number;
  sortOrder: number;
  isActive: boolean;
  isVisible: boolean;
  readOnly: boolean;
  options: CatalogVariableOption[];
}

export interface CatalogCategory {
  categoryId: number;
  categoryName: string;
}

export interface CatalogWorkflow {
  workflowId: number;
  workflowName: string;
}

export interface CatalogGroup {
  groupId: number;
  groupName: string;
}

export interface Catalog {
  catalogId: number;
  catalogName: string;
  catalogCode?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  category: CatalogCategory | null;
  subCategory?: string | null;
  itemType: string;
  isActive: boolean;
  allowRequestedFor: boolean;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  // Additional
  requestType: string;
  approvalRequired: boolean;
  stage: string;
  impact: string;
  urgency: string;
  defaultPriority: string;
  slaName?: string | null;
  tags?: string[] | null;
  keywords?: string | null;
  // Service offering
  serviceOffering?: string | null;
  businessService?: string | null;
  configurationItem?: string | null;
  // Time / cost
  estimatedTime?: number | null;
  deliveryTimeSla?: number | null;
  hidePrice: boolean;
  // Workflow
  workflow?: CatalogWorkflow | null;
  approvalPolicy?: string | null;
  fulfillmentWorkflow?: CatalogWorkflow | null;
  fulfillmentGroup?: CatalogGroup | null;
  assignmentGroup?: CatalogGroup | null;
  // Visibility
  availableInPortal: boolean;
  availableInMobile: boolean;
  showInCatalog: boolean;
  showInPopular: boolean;
  requiresApprovalFor: boolean;
  allowRequestsForOthers: boolean;
  enableDiscussion: boolean;
  visibleTo: string;
  userGroups?: string[] | null;
  departments?: string[] | null;
  locations?: string[] | null;
  variables: CatalogVariable[];
  createdAt?: string;
  updatedAt?: string;
}
