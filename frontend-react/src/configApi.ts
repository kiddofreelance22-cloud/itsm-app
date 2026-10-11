import { api } from "./api";

// ── shared ──
export interface MasterItem {
  id: number; name: string; description?: string | null; displayOrder: number; isActive: boolean;
  slaImpact?: "pause" | "continue";
}
export type MasterPayload = Partial<Pick<MasterItem, "name" | "description" | "displayOrder" | "isActive" | "slaImpact">>;
export const masterApi = {
  list: (path: string) => api.get<MasterItem[]>(path),
  create: (path: string, d: MasterPayload) => api.post<MasterItem>(path, d),
  update: (path: string, id: number, d: MasterPayload) => api.patch<MasterItem>(`${path}/${id}`, d),
  remove: (path: string, id: number) => api.delete<{ deleted: boolean }>(`${path}/${id}`),
};

// ── classification ──
export interface ClassificationRow { classificationId: number; name: string; parentId: number | null; level: number; isActive: boolean }
export const classificationApi = {
  list: () => api.get<ClassificationRow[]>("/classifications"),
  create: (d: { name: string; parentId?: number | null; isActive?: boolean }) => api.post<ClassificationRow>("/classifications", d),
  update: (id: number, d: { name?: string; parentId?: number | null; isActive?: boolean }) => api.patch<ClassificationRow>(`/classifications/${id}`, d),
  remove: (id: number) => api.delete<{ deleted: boolean }>(`/classifications/${id}`),
};

// ── status transitions ──
export interface TransitionMatrix { statuses: string[]; transitions: { from: string; to: string }[]; blocked?: { from: string; to: string }[] }
export const transitionApi = {
  get: () => api.get<TransitionMatrix>("/status-transitions"),
  setFor: (from: string, allowedTo: string[]) => api.put<TransitionMatrix>(`/status-transitions/${encodeURIComponent(from)}`, { allowedTo }),
  reset: () => api.post<TransitionMatrix>("/status-transitions/reset", {}),
};

// ── rules ──
export interface MandatoryRule { ruleId?: number; name: string; conditionField: string; conditionValues: string[]; targetFields: string[]; isActive: boolean }
export interface ApprovalRuleRow { ruleId?: number; name: string; action: "Resolve" | "Close" | "Reopen"; approvalType: string; conditionField: string; conditionValues: string[]; isActive: boolean }
export type RuleOptions = Record<string, string[]>;
export const ruleApi = {
  options: () => api.get<RuleOptions>("/rule-options"),
  mandatory: () => api.get<MandatoryRule[]>("/mandatory-field-rules"),
  // Only send what the server accepts: the GET adds ruleId / displayOrder / createdAt / updatedAt, which must not be echoed back.
  saveMandatory: (rules: MandatoryRule[]) => api.put<MandatoryRule[]>("/mandatory-field-rules", {
    rules: rules.map(({ name, conditionField, conditionValues, targetFields, isActive }) => ({ name, conditionField, conditionValues, targetFields, isActive })),
  }),
  approval: () => api.get<ApprovalRuleRow[]>("/approval-rules"),
  saveApproval: (rules: ApprovalRuleRow[]) => api.put<ApprovalRuleRow[]>("/approval-rules", { rules }),
};

// ── notifications ──
export interface NotificationRuleRow {
  ruleId: number; name: string; triggerEvent: string; recipients: string[]; subject: string; body: string; bodyFormat?: "text" | "html"; displayOrder: number; isActive: boolean;
}
export type NotificationPayload = Partial<Omit<NotificationRuleRow, "ruleId">>;
export const notificationApi = {
  list: () => api.get<NotificationRuleRow[]>("/notification-rules"),
  create: (d: NotificationPayload) => api.post<NotificationRuleRow>("/notification-rules", d),
  update: (id: number, d: NotificationPayload) => api.patch<NotificationRuleRow>(`/notification-rules/${id}`, d),
  remove: (id: number) => api.delete<{ deleted: boolean }>(`/notification-rules/${id}`),
};

// ── approvals ──
export interface ApprovalRequest {
  approvalId: number; incidentId: string; incidentRef: string; shortDescription: string; approvalType: string;
  action: string; status: "Pending" | "Approved" | "Rejected"; requestedBy: string; requestedAt: string;
  requestComments: string; approverNote: string; decidedAt: string | null;
}
export const approvalApi = {
  list: (pendingOnly = false) => api.get<ApprovalRequest[]>(`/incident-approvals${pendingOnly ? "?pending=true" : ""}`),
  approve: (id: number, note: string) => api.post<ApprovalRequest>(`/incident-approvals/${id}/approve`, { note }),
  reject: (id: number, note: string) => api.post<ApprovalRequest>(`/incident-approvals/${id}/reject`, { note }),
};

// ── feedback ──
export interface FeedbackRow {
  incidentId: string; incidentRef: string; submittedBy: string; date: string; rating: number; comment: string;
  published: boolean; flagged: boolean; moderatorNote: string; moderated: boolean;
}
export const feedbackApi = {
  list: (pendingOnly = false) => api.get<FeedbackRow[]>(`/feedback-moderation${pendingOnly ? "?pending=true" : ""}`),
  moderate: (incidentId: string, d: { note?: string; published?: boolean; flagged?: boolean }) =>
    api.patch<FeedbackRow>(`/feedback-moderation/${encodeURIComponent(incidentId)}`, d),
};

// ── work orders ──
export interface WorkOrderRow {
  workOrderId: number; woNumber: string; title: string; notes: string; incidentId: string | null; incidentRef: string | null;
  groupId: number | null; workgroup: string; assignedToId: number | null; assignedTo: string; priority: string; status: string;
  isActive: boolean; createdAt: string;
}
export interface WorkOrderPayload {
  incidentId?: string | null; title?: string; notes?: string | null; groupId?: number | null; assignedTo?: number | null;
  priority?: string; status?: string; isActive?: boolean;
}
export const workOrderApi = {
  list: () => api.get<WorkOrderRow[]>("/work-orders"),
  create: (d: WorkOrderPayload) => api.post<WorkOrderRow>("/work-orders", d),
  update: (id: number, d: WorkOrderPayload) => api.patch<WorkOrderRow>(`/work-orders/${id}`, d),
};
export const WO_STATUSES = ["Open", "In Progress", "On Hold", "Completed", "Cancelled"];
export const WO_PRIORITIES = ["P1 - Critical", "P2 - High", "P3 - Medium", "P4 - Low"];

// ── SLA ──
export interface SlaMatrixRow {
  slaMatrixId: number; groupId: number; workgroupName: string; priorityId: number; priorityName: string;
  responseMinutes: number; resolutionMinutes: number; defaultResponseMinutes: number | null; defaultResolutionMinutes: number | null; isActive: boolean;
}
export interface WorkgroupWindowRow { groupId: number; workgroupName: string; manager: string; slaServiceWindowId: number | null; isActive: boolean }
export const slaApi = {
  matrix: () => api.get<SlaMatrixRow[]>("/sla-matrix"),
  addMatrix: (d: { groupId: number; priorityId: number; responseMinutes: number; resolutionMinutes: number }) => api.post<SlaMatrixRow>("/sla-matrix", d),
  updateMatrix: (id: number, d: { responseMinutes?: number; resolutionMinutes?: number; isActive?: boolean }) => api.patch<SlaMatrixRow>(`/sla-matrix/${id}`, d),
  removeMatrix: (id: number) => api.delete<{ deleted: boolean }>(`/sla-matrix/${id}`),
  windows: () => api.get<WorkgroupWindowRow[]>("/workgroup-sla-windows"),
  setWindow: (groupId: number, d: { slaServiceWindowId?: number | null; isActive?: boolean }) => api.put<WorkgroupWindowRow>(`/workgroup-sla-windows/${groupId}`, d),
};

// ── priority matrix (existing endpoint) ──
export interface PriorityMatrixRow {
  priorityMatrixId: number; urgencyId: number; impactId: number; priorityId: number; isActive: boolean;
  urgency: { urgencyName: string }; impact: { impactName: string }; priority: { priorityName: string; priorityId: number };
}
export const priorityMatrixApi = {
  list: () => api.get<PriorityMatrixRow[]>("/priority-matrices"),
  create: (d: { urgencyId: number; impactId: number; priorityId: number }) => api.post<PriorityMatrixRow>("/priority-matrices", d),
  update: (id: number, d: { priorityId?: number; isActive?: boolean }) => api.patch<PriorityMatrixRow>(`/priority-matrices/${id}`, d),
  remove: (id: number) => api.delete<unknown>(`/priority-matrices/${id}`),
};

// ── directory ──
export interface DirectorySourceRow {
  sourceId: number; type: "ldap" | "azure_ad"; name: string; isActive: boolean; autoCreateUsers: boolean;
  ldapUrl: string | null; bindDn: string | null; baseDn: string | null; searchFilter: string | null; defaultRole: string | null;
  tenantId: string | null; clientId: string | null; redirectUri: string | null; ssoEnabled: boolean; ssoOnly: boolean; allowedDomains: string | null;
  hasBindPassword: boolean; hasClientSecret: boolean; lastTestOk: boolean | null; lastTestMessage: string | null; lastTestedAt: string | null;
}
export type DirectorySourcePayload = Partial<Omit<DirectorySourceRow, "sourceId" | "type" | "hasBindPassword" | "hasClientSecret" | "lastTestOk" | "lastTestMessage" | "lastTestedAt">> & { bindPassword?: string; clientSecret?: string };
export interface MappingRow { mappingId?: number; localField: string; externalAttribute: string; isActive: boolean; isCustom: boolean; displayOrder?: number }
export interface SyncRun { runId: number; startedAt: string; status: string; fetched: number; created: number; updated: number; failed: number; triggeredBy: string; message: string | null }
export const directoryApi = {
  sources: () => api.get<DirectorySourceRow[]>("/directory/sources"),
  create: (type: "ldap" | "azure_ad") => api.post<DirectorySourceRow>("/directory/sources", { type }),
  update: (id: number, d: DirectorySourcePayload) => api.patch<DirectorySourceRow>(`/directory/sources/${id}`, d),
  remove: (id: number) => api.delete<{ deleted: boolean }>(`/directory/sources/${id}`),
  test: (id: number) => api.post<{ ok: boolean; message: string }>(`/directory/sources/${id}/test`, {}),
  customAttributes: () => api.get<MappingRow[]>("/directory/custom-attributes"),
  mappings: (id: number) => api.get<MappingRow[]>(`/directory/sources/${id}/mappings`),
  saveMappings: (id: number, rows: MappingRow[]) =>
    api.put<MappingRow[]>(`/directory/sources/${id}/mappings`, {
      rows: rows.map((r, idx) => ({
        localField: r.localField,
        externalAttribute: r.externalAttribute,
        isActive: r.isActive ?? true,
        isCustom: r.isCustom ?? false,
        displayOrder: r.displayOrder ?? idx + 1,
        mappingId: r.mappingId,
        sourceId: id,
      })),
    }),
  history: (id: number) => api.get<SyncRun[]>(`/directory/sources/${id}/history`),
  sync: (id: number) => api.post<SyncRun>(`/directory/sources/${id}/sync`, {}),
};

// ── Log Incident Page ──
export interface LogField { fieldKey: string; name: string; section: string; visible: boolean; required: boolean; displayOrder: number }
export const logFieldApi = {
  list: () => api.get<LogField[]>("/log-incident-fields"),
  save: (fields: { fieldKey: string; visible: boolean; required: boolean }[]) => api.put<LogField[]>("/log-incident-fields", { fields }),
  reset: () => api.post<LogField[]>("/log-incident-fields/reset", {}),
};

// ── Attachments ──
export interface Attachment { attachmentId: number; fileName: string; mimeType: string; sizeBytes: number; uploadedAt: string; uploadedBy: number | null }
export const ATTACH_TYPES = ["jpg", "jpeg", "png", "pdf", "docx"];
export const ATTACH_MAX = 10 * 1024 * 1024;
export const attachmentApi = {
  list: (incidentId: string) => api.get<Attachment[]>(`/incidents/${encodeURIComponent(incidentId)}/attachments`),
  upload: (incidentId: string, file: File) => { const f = new FormData(); f.append("file", file); return api.upload<Attachment>(`/incidents/${encodeURIComponent(incidentId)}/attachments`, f); },
  remove: (incidentId: string, id: number) => api.delete<{ deleted: boolean }>(`/incidents/${encodeURIComponent(incidentId)}/attachments/${id}`),
  download: (incidentId: string, a: Attachment) => api.download(`/incidents/${encodeURIComponent(incidentId)}/attachments/${a.attachmentId}/download`, a.fileName),
};
/** Client-side pre-check so the user gets instant feedback (the server re-validates everything). */
export function checkAttachment(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ATTACH_TYPES.includes(ext)) return `${file.name}: unsupported type. Allowed: jpg, png, pdf, docx.`;
  if (file.size > ATTACH_MAX) return `${file.name}: larger than 10 MB.`;
  if (file.size === 0) return `${file.name}: the file is empty.`;
  return null;
}
export const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

// ── Incident Record extras ──
export interface ChecklistItem { id: number; name: string; description: string; required: boolean; done: boolean; checklist?: string }
export interface IncidentChecklist { items: ChecklistItem[]; doneCount: number; total: number; requiredOpen: number; requiredTotal: number }
export interface RelatedItem { linkId: number; incidentId: string; incidentRef: string; shortDescription: string; status: string }
export const recordApi = {
  checklist: (id: string) => api.get<IncidentChecklist>(`/incidents/${encodeURIComponent(id)}/checklist`),
  toggle: (id: string, itemId: number, done: boolean) => api.patch<IncidentChecklist>(`/incidents/${encodeURIComponent(id)}/checklist`, { itemId, done }),
  links: (id: string) => api.get<RelatedItem[]>(`/incidents/${encodeURIComponent(id)}/links`),
  link: (id: string, incidentRef: string) => api.post<RelatedItem[]>(`/incidents/${encodeURIComponent(id)}/links`, { incidentRef }),
  unlink: (id: string, linkId: number) => api.delete<RelatedItem[]>(`/incidents/${encodeURIComponent(id)}/links/${linkId}`),
  resumeSla: (id: string) => api.post<unknown>(`/incidents/${encodeURIComponent(id)}/resume-sla`, {}),
  workOrders: (id: string) => api.get<WorkOrderRow[]>(`/work-orders?incidentId=${encodeURIComponent(id)}`),
};
