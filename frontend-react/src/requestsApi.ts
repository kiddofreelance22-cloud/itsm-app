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
  parentCategoryId?: number | null;
  level?: number;
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
  maxLength?: number | null;
  noPastDates?: boolean;
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
  isActive?: boolean;
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
  priorityId?: number | null;
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
  /** Default SERVICE impact for requests from this item (separate from the incident impact). */
  serviceImpact?: { serviceImpactId: number; impactName: string } | null;
  estimatedCost?: string | number | null;
  urgency?: { urgencyId: number; urgencyName: string } | null;
  estimatedTime?: number | null;
  deliveryTimeSla?: number | null;
  formLayout?: string | null;
  variables?: CatalogVariable[];
  sections?: CatalogSection[];
  attachments?: CatalogAttachment[];
}

export interface ServiceImpactItem {
  serviceImpactId: number;
  impactName: string;
  description?: string | null;
  isActive?: boolean;
}

export type SlaState = "not_started" | "on_track" | "at_risk" | "breached" | "paused" | "met";

export interface RequestApprovalRow {
  requestApprovalId: number;
  levelNumber: number;
  title: string;
  approverType: "user" | "group" | "role" | "custom" | "requester_manager" | "parallel";
  status: "Pending" | "Approved" | "Rejected" | "Skipped" | "Escalated" | "Info requested";
  actedBy?: { userId: number; fullName: string } | null;
  actedAt?: string | null;
  comments?: string | null;
  myVoteStatus?: "none" | "Approved" | "Rejected" | "Info requested";
  myVoteAt?: string | null;
  canAct?: boolean;
}

export interface RequestTaskRow {
  requestTaskId: number;
  taskName: string;
  description?: string | null;
  status: "Open" | "In Progress" | "Completed" | "Cancelled";
  priority: string;
  dueAt?: string | null;
  completedAt?: string | null;
  completedBy?: { fullName: string } | null;
}

export interface RequestHistoryEntry {
  historyId: number;
  action: string;
  comments?: string | null;
  actionAt: string;
  actionBy?: { userId: number; fullName: string } | null;
}

type Named<K extends string, N extends string> = { [P in K | N]: P extends K ? number : string };

export interface ServiceRequest {
  requestId: number;
  /** Stored number, e.g. REQ00000012 (generated by the database). */
  requestNumber?: string;
  status: string;
  subStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  catalog: {
    catalogId?: number; catalogName: string; category?: { categoryName: string } | null;
    deliveryTimeSla?: number | null; estimatedTime?: number | null;
    fulfillmentGroup?: { groupId: number; groupName: string } | null; assignmentGroup?: { groupId: number; groupName: string } | null;
  };
  requestedBy?: { userId?: number; fullName?: string; email?: string } | null;
  /** Who raised it, when that is not the requester (a request raised for someone else). */
  submittedBy?: { userId?: number; fullName?: string } | null;
  currentStep?: { stepName?: string } | null;
  variableValues?: { variable: { variableId: number; label: string }; value: string }[];
  urgency?: Named<"urgencyId", "urgencyName"> | null;
  serviceImpact?: Named<"serviceImpactId", "impactName"> | null;
  priority?: (Named<"priorityId", "priorityName"> & {
    color?: string | null;
    responseSlaMinutes?: number | null;
    resolutionSlaMinutes?: number | null;
  }) | null;
  assignmentGroup?: Named<"groupId", "groupName"> | null;
  assignedTo?: { userId: number; fullName: string } | null;
  approvals?: RequestApprovalRow[];
  tasks?: RequestTaskRow[];
  estimatedCost?: string | null;
  claimedAt?: string | null;
  slaStartedAt?: string | null;
  slaResponseTarget?: string | null;
  slaFulfilmentTarget?: string | null;
  slaResponseMet?: boolean;
  slaPausedAt?: string | null;
  slaBreached?: boolean;
  pendingReason?: { pendingReasonId: number; pendingReasonName: string } | null;
  holdNotes?: string | null;
  closureCode?: { closureCodeId: number; closureCodeName: string } | null;
  fulfilmentNotes?: string | null;
  fulfilledAt?: string | null;
  autoCloseAt?: string | null;
  feedbackRating?: number | null;
  feedbackComment?: string | null;
  feedbackSubmittedAt?: string | null;
  sla?: { state: SlaState; responseTarget: string | null; fulfilmentTarget: string | null; pausedAt: string | null };
}

/** GET /requests/:id */
export interface ApprovalGuide {
  stage: string; ifApprove: string; ifReject: string; canReject: boolean; canInfo: boolean; canDelegate: boolean;
  comment: "optional" | "reject" | "both"; timing: string;
}
export interface ServiceRequestDetail extends ServiceRequest {
  history: RequestHistoryEntry[];
  viewer: { isRequester: boolean; isAgent: boolean; canApprove: boolean; canResubmit?: boolean };
  /** What each decision does, for the approver who can act now. */
  guide?: ApprovalGuide | null;
}

export interface RequestQueueQuery {
  status?: string;
  groupId?: number;
  assignee?: string;
  priorityId?: number;
  q?: string;
  sla?: "breached";
  page?: number;
  pageSize?: number;
}
export interface RequestQueuePage {
  items: ServiceRequest[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<string, number>;
  mine: number;
}

export interface ApprovalItem {
  requestId: number;
  requestNumber: string;
  catalogName: string | null;
  category: string | null;
  requestedBy: string | null;
  createdAt: string;
  estimatedCost: string | null;
  priority: string | null;
  stage: string;
  levelNumber: number;
  state: "Awaiting me" | "Responded, waiting for others" | "Approved" | "Rejected" | "Requested information";
  status: string;
  actedAt: string | null;
}

export interface PathPreview {
  approvals: { title: string; approver: string; rule: string | null }[];
  fulfilmentGroup: string | null; deliveryDays: number | null; tasks: number;
}

export interface CreateServiceRequest {
  /** Raise the request for another person; you are recorded as the submitter. */
  requestedForUserId?: number;
  catalogId: number;
  variableValues: { variableId: number; value: string }[];
  urgencyId?: number;
  serviceImpactId?: number;
  notes?: string;
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
  maxLength?: number;
  noPastDates?: boolean;
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
  serviceImpactId?: number | null;
  estimatedCost?: number;
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
  priorities: () => api.get<CatalogLookupItem[]>("/service-priorities"),
  impacts: () => api.get<CatalogLookupItem[]>("/service-impacts"),
  urgencies: () => api.get<CatalogLookupItem[]>("/service-urgencies"),
  slaWindows: () => api.get<any[]>("/request-sla-service-windows"),
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
  /** The route a request would take for these answers. Nothing is saved. */
  previewPath: (catalogId: number, variableValues: { variableId: number; value: string }[]) => api.post<PathPreview>("/requests/preview-path", { catalogId, variableValues }),
  createForUser: (requestedById: number, body: CreateServiceRequest) =>
    api.post<ServiceRequest>("/requests/admin", { ...body, requestedById }),
  update: (id: number, body: { variableValues: CreateServiceRequest["variableValues"]; comments?: string }) =>
    api.patch<ServiceRequest>(`/requests/${id}`, body),
  cancel: (id: number, comments?: string) => api.post<ServiceRequest>(`/requests/${id}/cancel`, comments ? { comments } : {}),
  /** Requester answers an approver who returned the request, and sends it back into approval. */
  resubmit: (id: number, comments?: string) => api.post<ServiceRequest>(`/requests/${id}/resubmit`, comments ? { comments } : {}),
  serviceImpacts: () => api.get<ServiceImpactItem[]>("/service-impacts"),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<UploadedRequestFile>("/uploads", form);
  },
};

const qs = (params: Record<string, string | number | undefined>) => {
  const parts = Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

/** Service request lifecycle: queue, record, agent and requester actions, approvals. */
export const requestLifecycleApi = {
  queue: (q: RequestQueueQuery = {}) => api.get<RequestQueuePage>(`/requests/queue${qs({ ...q })}`),
  detail: (id: number) => api.get<ServiceRequestDetail>(`/requests/${id}`),
  assign: (id: number, body: { assignmentGroupId?: number; assigneeId?: number; start?: boolean; comments?: string }) =>
    api.post<ServiceRequest>(`/requests/${id}/assign`, body),
  start: (id: number) => api.post<ServiceRequest>(`/requests/${id}/start`, {}),
  hold: (id: number, body: { pendingReasonId?: number; subStatus?: string; notes?: string }) => api.post<ServiceRequest>(`/requests/${id}/hold`, body),
  resume: (id: number) => api.post<ServiceRequest>(`/requests/${id}/resume`, {}),
  subStatus: (id: number, subStatus: string | null) => api.patch<ServiceRequest>(`/requests/${id}/sub-status`, { subStatus }),
  fulfil: (id: number, body: { closureCodeId: number; notes: string }) => api.post<ServiceRequest>(`/requests/${id}/fulfil`, body),
  classify: (id: number, body: { urgencyId?: number; serviceImpactId?: number }) => api.patch<ServiceRequest>(`/requests/${id}/classification`, body),
  task: (id: number, taskId: number, status: RequestTaskRow["status"]) => api.patch<ServiceRequest>(`/requests/${id}/tasks/${taskId}`, { status }),
  close: (id: number, comments?: string) => api.post<ServiceRequest>(`/requests/${id}/close`, comments ? { comments } : {}),
  reopen: (id: number, comments: string) => api.post<ServiceRequest>(`/requests/${id}/reopen`, { comments }),
  rate: (id: number, rating: number, comment?: string) => api.post<ServiceRequest>(`/requests/${id}/rate`, { rating, ...(comment ? { comment } : {}) }),
  comment: (id: number, comments: string) => api.post<ServiceRequest>(`/requests/${id}/comments`, { comments }),
  approvals: () => api.get<ApprovalItem[]>("/approvals"),
  requestInfo: (id: number, comments: string) => api.post<ServiceRequest>(`/approvals/${id}/request-info`, { comments }),
  delegate: (id: number, toUserId: number, comments?: string) => api.post<ServiceRequest>(`/approvals/${id}/delegate`, comments ? { toUserId, comments } : { toUserId }),
  decide: (id: number, action: "Approved" | "Rejected", comments?: string, requestApprovalId?: number) =>
    api.post<ServiceRequest>(`/approvals/${id}/action`, {
      action,
      ...(comments ? { comments } : {}),
      ...(requestApprovalId ? { requestApprovalId } : {}),
    }),
  closureCodes: () => api.get<{ closureCodeId: number; closureCodeName: string; isActive?: boolean }[]>("/closure-codes"),
  pendingReasons: () => api.get<{ pendingReasonId: number; pendingReasonName: string; slaImpact?: string; isActive?: boolean }[]>("/request-pending-reasons"),
};

export type RequestStage = "approval" | "queue" | "work" | "hold" | "done" | "closed" | "stopped";
export interface RequestStatusItem {
  requestStatusId: number;
  statusName: string;
  description?: string | null;
  stage: RequestStage;
  color: string;
  isSystem: boolean;
  isActive: boolean;
  displayOrder: number;
  clock: "running" | "paused" | "stopped";
  inUse: number;
}
export interface ApproverGroupItem {
  approverGroupId: number;
  groupName: string;
  description: string | null;
  isActive: boolean;
  memberCount: number;
  members: string[];
  usedIn: string[];
}
export interface ApproverGroupDetail {
  approverGroupId: number;
  groupName: string;
  description: string | null;
  isActive: boolean;
  members: { userId: number; fullName: string; email: string; jobTitle: string | null }[];
  usedIn: string[];
}
export interface RequestMatrixRow {
  requestPriorityMatrixId: number;
  urgencyId: number;
  serviceImpactId: number;
  priorityId: number;
  isActive: boolean;
  urgency: { urgencyName: string };
  serviceImpact: { impactName: string };
  priority: { priorityName: string };
}
export interface NotificationMeta {
  events: { key: string; label: string }[];
  recipients: { key: string; label: string }[];
  mergeFields: string[];
}
export interface StageInfo { key: RequestStage; label: string; hint: string }
export interface NotificationRuleItem {
  ruleId: number;
  ruleName: string;
  eventKey: string;
  recipients: string[];
  subject: string;
  body: string;
  isActive: boolean;
  displayOrder: number;
}
export type NotificationRuleInput = Pick<NotificationRuleItem, "ruleName" | "eventKey" | "recipients" | "subject" | "body"> & { isActive?: boolean; displayOrder?: number };

export const requestConfigApi = {
  statuses: () => api.get<RequestStatusItem[]>("/request-statuses"),
  stages: () => api.get<StageInfo[]>("/request-statuses/stages"),
  notificationMeta: () => api.get<NotificationMeta>("/request-notification-rules/meta"),
  createStatus: (body: { statusName: string; stage: "work" | "hold"; color?: string; description?: string | null; isActive?: boolean }) => api.post<RequestStatusItem>("/request-statuses", body),
  updateStatus: (id: number, body: Partial<{ statusName: string; stage: "work" | "hold"; color: string; description: string | null; isActive: boolean }>) => api.patch<RequestStatusItem>(`/request-statuses/${id}`, body),
  deleteStatus: (id: number) => api.delete<void>(`/request-statuses/${id}`),

  groups: () => api.get<ApproverGroupItem[]>("/approver-groups"),
  group: (id: number) => api.get<ApproverGroupDetail>(`/approver-groups/${id}`),
  createGroup: (body: { groupName: string; description?: string | null; isActive?: boolean; memberIds: number[] }) => api.post<ApproverGroupDetail>("/approver-groups", body),
  updateGroup: (id: number, body: Partial<{ groupName: string; description: string | null; isActive: boolean; memberIds: number[] }>) => api.patch<ApproverGroupDetail>(`/approver-groups/${id}`, body),
  deleteGroup: (id: number) => api.delete<void>(`/approver-groups/${id}`),

  matrix: () => api.get<RequestMatrixRow[]>("/request-priority-matrix"),
  createMatrix: (body: { urgencyId: number; serviceImpactId: number; priorityId: number }) => api.post<RequestMatrixRow>("/request-priority-matrix", body),
  updateMatrix: (id: number, body: { priorityId?: number; isActive?: boolean }) => api.patch<RequestMatrixRow>(`/request-priority-matrix/${id}`, body),

  rules: () => api.get<NotificationRuleItem[]>("/request-notification-rules"),
  createRule: (body: NotificationRuleInput) => api.post<NotificationRuleItem>("/request-notification-rules", body),
  updateRule: (id: number, body: Partial<NotificationRuleInput>) => api.patch<NotificationRuleItem>(`/request-notification-rules/${id}`, body),
  deleteRule: (id: number) => api.delete<void>(`/request-notification-rules/${id}`),
};

/* ───────── service categories (up to five levels) ───────── */
export interface ServiceCategoryNode {
  serviceCategoryId: number;
  categoryName: string;
  description?: string | null;
  parentCategoryId?: number | null;
  isActive: boolean;
  sortOrder: number;
  level: number;
  childCount: number;
  itemCount: number;
}
export const MAX_CATEGORY_LEVEL = 5;
export const serviceCategoryApi = {
  list: () => api.get<ServiceCategoryNode[]>("/service-categories"),
  create: (body: { categoryName: string; parentCategoryId?: number | null; description?: string; isActive?: boolean }) => api.post<ServiceCategoryNode>("/service-categories", body),
  update: (id: number, body: Partial<{ categoryName: string; parentCategoryId: number | null; description: string; isActive: boolean }>) => api.patch<ServiceCategoryNode>(`/service-categories/${id}`, body),
  remove: (id: number) => api.delete<void>(`/service-categories/${id}`),
};

/* ───────── lifecycles (workflows) ───────── */
export interface LifecycleApprovalLevel {
  approvalLevelId?: number;
  levelNumber: number;
  title: string;
  approverType: "user" | "group" | "role" | "custom" | "requester_manager" | "parallel";
  approverId?: number | null;
  /** any = one decision settles it; majority / all collect an answer from each approver. */
  approvalRule?: "any" | "majority" | "all";
  /** approverType "parallel": everyone asked at the same time. */
  approvers?: { type: "user" | "group" | "role" | "custom" | "requester_manager"; ref?: number | null; label?: string }[];
  customGroup?: { groupId: number; groupName: string } | null;
  autoApproval?: boolean;
  commentPolicy?: "optional" | "reject" | "both";
  allowReject?: boolean; allowInfo?: boolean; allowDelegate?: boolean;
  remindDays?: number; timeoutDays?: number;
  onTimeout?: "escalate" | "approve" | "reject";
  timeoutArg?: string | null;
  /** What happens when this level is approved. Default next. */
  onApprove?: "next" | "fulfil" | "step" | "notify" | "priority" | "assign" | "reroute" | "task" | "auto";
  /** step: workflowStepId; notify: "<type>:<id>"; priority / assign / reroute: id; task: text. */
  approveArg?: string | null;
  /** What happens when this level is rejected. Default close. */
  onReject?: "close" | "rework" | "back" | "escalate" | "continue";
  /** back: earlier approvalLevelId; escalate: "<type>:<id>"; rework: "this" | "start". */
  rejectArg?: string | null;
}
export interface LifecycleStep {
  workflowStepId: number;
  stepName: string;
  stepOrder: number;
  stepType: "approval" | "task" | "condition" | "notification" | "wait" | "subflow" | "update" | "record" | "integration";
  conditionExpression?: string | null;
  approverRole?: { roleId: number; roleName: string } | null;
  approvalLevels?: LifecycleApprovalLevel[];
  /** notification: { ruleId, to[] }; update: { field, value } */
  config?: Record<string, unknown> | null;
}
export interface LifecycleTransition { transitionId?: number; branch: "yes" | "no"; fromStep: { workflowStepId: number }; toStep: { workflowStepId: number } }
export type LifecycleScope = "service_request" | "knowledge";
export interface Lifecycle {
  workflowId: number;
  workflowName: string;
  workflowScope: LifecycleScope;
  description?: string | null;
  isActive: boolean;
  status: string;
  requiresApproval?: boolean;
  approverRole?: { roleId: number; roleName: string } | null;
  steps: LifecycleStep[];
  transitions?: LifecycleTransition[];
}
export interface LifecycleTask {
  workflowTaskId?: number;
  taskName: string;
  description?: string | null;
  assigneeType: "user" | "group" | "role";
  assigneeId?: number | null;
  dueDateHours?: number | null;
  priority?: "low" | "medium" | "high" | "critical";
}
export const lifecycleApi = {
  list: (scope: LifecycleScope = "service_request") => api.get<Lifecycle[]>(`/workflows?scope=${scope}`),
  get: (id: number) => api.get<Lifecycle>(`/workflows/${id}`),
  usage: () => api.get<Record<number, string[]>>("/workflows/usage"),
  create: (body: { workflowName: string; workflowScope?: LifecycleScope; description?: string; isActive?: boolean; status?: string; steps?: unknown[] }) => api.post<Lifecycle>("/workflows", body),
  update: (id: number, body: Partial<{ workflowName: string; description: string; isActive: boolean; status: string }>) => api.patch<Lifecycle>(`/workflows/${id}`, body),
  remove: (id: number) => api.delete<void>(`/workflows/${id}`),
  addStep: (id: number, body: { stepName: string; stepOrder: number; stepType: LifecycleStep["stepType"]; approvalLevels?: LifecycleApprovalLevel[]; config?: Record<string, unknown> }) => api.post<Lifecycle>(`/workflows/${id}/steps`, body),
  updateStep: (id: number, stepId: number, body: Partial<{ stepName: string; conditionExpression: string }>) => api.patch<LifecycleStep>(`/workflows/${id}/steps/${stepId}`, body),
  removeStep: (id: number, stepId: number) => api.delete<void>(`/workflows/${id}/steps/${stepId}`),
  reorderStep: (id: number, stepId: number, newOrder: number) => api.patch<LifecycleStep>(`/workflows/${id}/steps/${stepId}/reorder`, { newOrder }),
  setApprovalLevels: (id: number, stepId: number, levels: LifecycleApprovalLevel[]) => api.put<LifecycleApprovalLevel[]>(`/workflows/${id}/steps/${stepId}/approval-levels`, { levels }),
  tasks: (id: number, stepId: number) => api.get<LifecycleTask[]>(`/workflows/${id}/steps/${stepId}/tasks`),
  setTasks: (id: number, stepId: number, tasks: LifecycleTask[]) => api.put<LifecycleTask[]>(`/workflows/${id}/steps/${stepId}/tasks`, { tasks }),
  setTransitions: (id: number, stepId: number, transitions: { branch: "yes" | "no"; targetStepId: number }[]) => api.patch<unknown>(`/workflows/${id}/steps/${stepId}/transitions`, { transitions }),
};

/** Linked records and work notes on a service request (see BACKEND-CONTRACT.md). */
export type RelatedType = "request" | "incident" | "change" | "problem" | "work_order";
export const LINK_RELATIONS = ["Related to", "Parent of", "Child of", "Caused by", "Cause of", "Duplicate of", "Duplicated by"] as const;
export interface RelatedLink {
  linkId: number; type: RelatedType; number: string; title: string; status: string; relation: string;
  details: string | null; group: string | null; direction: "out" | "in"; createdAt: string;
  /** Other requests that link to the same ticket. */
  alsoLinked?: string[];
  /** Id used to open the ticket when that ticket type has an id-based route. */
  targetId?: string | number | null;
}
export interface LinkCandidate { id?: string | number; type: RelatedType; number: string; title: string; status: string; group: string | null; raisedBy: string | null; createdAt: string | null }
export interface LinkCandidateQuery { type: RelatedType; q?: string; state?: "any" | "open" | "closed"; raisedBy?: "any" | "me"; raised?: "any" | "1" | "7" | "30" | "90"; match?: "none" | "requester" | "group"; sort?: "newest" | "oldest" | "number" }
export interface CreateRelatedBody {
  type: RelatedType; shortDescription: string; description?: string; relation?: string;
  priority?: string; changeType?: "Standard" | "Normal" | "Emergency"; plannedDate?: string; location?: string; catalogId?: number; convert?: boolean;
}
export interface WorkNote { noteId: number; text: string; createdAt: string; createdBy?: { userId: number; fullName: string } | null }
export const requestLinksApi = {
  list: (id: number) => api.get<RelatedLink[]>(`/requests/${id}/links`),
  attach: (id: number, body: { type: RelatedType; targetNumber: string; relation?: string; title?: string }) => api.post<RelatedLink>(`/requests/${id}/links`, body),
  create: (id: number, body: CreateRelatedBody) => api.post<RelatedLink>(`/requests/${id}/links/create`, body),
  remove: (id: number, linkId: number) => api.delete<void>(`/requests/${id}/links/${linkId}`),
  delink: (id: number, linkId: number) => api.delete<void>(`/requests/${id}/links/${linkId}`),
  updateRelation: (id: number, linkId: number, relation: string) => api.patch<RelatedLink>(`/requests/${id}/links/${linkId}`, { relation }),
  candidates: (id: number, q: LinkCandidateQuery) => api.get<{ items: LinkCandidate[]; note?: string }>(`/requests/${id}/links/candidates?${new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString()}`),
  notes: (id: number) => api.get<WorkNote[]>(`/requests/${id}/work-notes`),
  addNote: (id: number, text: string) => api.post<WorkNote>(`/requests/${id}/work-notes`, { text }),
};
