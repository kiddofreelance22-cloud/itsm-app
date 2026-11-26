import { api } from "./api";

export type CsmCustomerType = "B2B" | "B2C";
export type CsmPriority = "Low" | "Medium" | "High" | "Critical";
export type CsmCaseStatus = "New" | "Open" | "Assigned" | "In Progress" | "Pending Customer" | "Resolved" | "Closed";

export interface CsmCustomer {
  customerId: number;
  customerCode: string;
  customerType: CsmCustomerType;
  name: string;
  email: string | null;
  phone: string | null;
  industry: string | null;
  accountType: string | null;
  region: string | null;
  website: string | null;
  location: string | null;
  segment: string | null;
  preferredChannel: string | null;
  status: string;
}

export interface CsmContact {
  contactId: number;
  customerId: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  isPrimary: boolean;
  status: string;
}

export interface CsmAttachment {
  attachmentId: number;
  caseId: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: number | null;
  uploadedAt: string;
}

export interface CsmCase {
  caseId: number;
  caseCode: string;
  customerId: number;
  customerCode: string;
  customerName: string;
  customerType: CsmCustomerType;
  customerContact: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  caseType: string;
  category: string;
  subcategory: string | null;
  productService: string | null;
  shortDescription: string;
  description: string;
  priority: CsmPriority;
  impact: string;
  urgency: string;
  status: CsmCaseStatus;
  source: string;
  assignmentGroupId: number | null;
  assignmentGroup: string | null;
  assignedToId: number | null;
  assignedTo: string | null;
  slaId: number | null;
  slaName: string | null;
  slaResponseTarget: string | null;
  slaResolutionTarget: string | null;
  slaResponseMet: boolean | null;
  issueDetails: Record<string, unknown>;
  resolutionCode: string | null;
  resolutionSummary: string | null;
  closureNotes: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  activity?: CsmActivity[];
  relatedMajorCases?: { majorCaseId: number; majorCaseCode: string; title: string; status: string }[];
}

export interface CsmActivity {
  activityId: number;
  activityType: string;
  content: string;
  createdAt: string;
  createdBy: string | null;
}

export interface CsmLookups {
  groups: { id: number; label: string }[];
  users: { id: number; label: string; email: string }[];
  customers: { id: number; code: string; label: string; type: CsmCustomerType }[];
  slas: { id: number; label: string; service: string }[];
  groupMembers: { groupId: number; userId: number }[];
}

export interface CsmContract {
  contractId: number;
  contractCode: string;
  customerId: number;
  customerName: string;
  customerType: CsmCustomerType;
  contractName: string;
  contractType: string;
  ownerName: string | null;
  status: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  description: string | null;
  services: string[];
  slaCount: number;
}

export interface CsmSla {
  slaId: number;
  slaCode: string;
  slaName: string;
  slaType: string;
  service: string;
  contractId: number | null;
  contractName: string | null;
  appliesTo: string[];
  priorities: string[];
  responseMinutes: number;
  resolutionMinutes: number;
  availabilityPercent: number | null;
  status: string;
  description: string | null;
}

export interface CsmEscalation {
  escalationId: number;
  escalationCode: string;
  caseId: number;
  caseCode: string;
  caseTitle: string;
  customerName: string;
  customerType: CsmCustomerType;
  escalationType: string;
  level: string;
  priority: CsmPriority;
  targetGroupId: number | null;
  targetGroup: string | null;
  targetUserId: number | null;
  targetUser: string | null;
  dueBy: string;
  reason: string;
  comments: string | null;
  recipients: string[];
  status: string;
}

export interface CsmMajorCase {
  majorCaseId: number;
  majorCaseCode: string;
  title: string;
  description: string;
  productService: string;
  majorCaseType: string;
  severity: CsmPriority;
  businessImpact: string;
  impactType: string;
  estimatedImpact: string | null;
  ownerId: number | null;
  ownerName: string | null;
  incidentCommanderId: number | null;
  incidentCommander: string | null;
  resolverGroupId: number | null;
  resolverGroup: string | null;
  coordinationGroupId: number | null;
  coordinationGroup: string | null;
  status: string;
  incidentStart: string;
  targetRestoration: string;
  notifyCustomers: boolean;
  communicationChannels: string[];
  relatedCaseIds: number[];
}

export interface CsmCaseView {
  viewId: number;
  viewName: string;
  description: string | null;
  filters: { status?: string; priority?: string; customerType?: string };
  isShared: boolean;
}

export const csmApi = {
  dashboard: () => api.get<{
    totalCases: number; openCases: number; priorityCases: number; slaBreaches: number;
    createdThisMonth: number; customers: number; withinSla: number; recentCases: CsmCase[];
  }>("/csm/dashboard"),
  lookups: () => api.get<CsmLookups>("/csm/lookups"),
  cases: (params: { q?: string; status?: string; priority?: string; customerType?: string; viewId?: number } = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, String(value)); });
    const qs = query.toString();
    return api.get<CsmCase[]>(`/csm/cases${qs ? `?${qs}` : ""}`);
  },
  case: (id: number) => api.get<CsmCase>(`/csm/cases/${id}`),
  createCase: (body: Record<string, unknown>) => api.post<CsmCase>("/csm/cases", body),
  updateCase: (id: number, body: Record<string, unknown>) => api.patch<CsmCase>(`/csm/cases/${id}`, body),
  addActivity: (id: number, body: { activityType: string; content: string }) =>
    api.post<{ activityId: number }>(`/csm/cases/${id}/activity`, body),
  caseAttachments: (id: number) => api.get<CsmAttachment[]>(`/csm/cases/${id}/attachments`),
  uploadCaseAttachment: (id: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<CsmAttachment>(`/csm/cases/${id}/attachments`, form);
  },
  deleteCaseAttachment: (id: number, attachmentId: number) =>
    api.delete<{ deleted: boolean }>(`/csm/cases/${id}/attachments/${attachmentId}`),
  downloadCaseAttachment: (id: number, attachment: CsmAttachment) =>
    api.download(`/csm/cases/${id}/attachments/${attachment.attachmentId}/download`, attachment.fileName),
  customers: (q = "", type?: CsmCustomerType) => {
    const query = new URLSearchParams();
    if (q.trim()) query.set("q", q.trim());
    if (type) query.set("type", type);
    const qs = query.toString();
    return api.get<CsmCustomer[]>(`/csm/customers${qs ? `?${qs}` : ""}`);
  },
  createCustomer: (body: Record<string, unknown>) => api.post<CsmCustomer>("/csm/customers", body),
  customerContacts: (id: number) => api.get<CsmContact[]>(`/csm/customers/${id}/contacts`),
  customerProfile: (id: number) => api.get<CsmCustomer & {
    parentCustomerId: number | null; parentCustomer: string | null; createdAt: string; updatedAt: string;
    contacts: CsmContact[]; contracts: CsmContract[]; cases: Pick<CsmCase, "caseId" | "caseCode" | "shortDescription" | "caseType" | "priority" | "status" | "createdAt">[];
  }>(`/csm/customers/${id}`),
  updateCustomer: (id: number, body: Record<string, unknown>) => api.patch<CsmCustomer>(`/csm/customers/${id}`, body),
  createContact: (id: number, body: Record<string, unknown>) => api.post<CsmContact>(`/csm/customers/${id}/contacts`, body),
  updateContact: (id: number, contactId: number, body: Record<string, unknown>) => api.patch<CsmContact>(`/csm/customers/${id}/contacts/${contactId}`, body),
  customerHealth: (q = "") => api.get<(CsmCustomer & { caseCount: number; openCases: number; slaBreaches: number; activeContracts: number; healthScore: number })[]>(`/csm/customer-health${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`),
  contracts: () => api.get<CsmContract[]>("/csm/contracts"),
  createContract: (body: Record<string, unknown>) => api.post<CsmContract>("/csm/contracts", body),
  updateContract: (id: number, body: Record<string, unknown>) => api.patch<CsmContract>(`/csm/contracts/${id}`, body),
  renewContract: (id: number, body: { startDate: string; endDate: string }) => api.post<CsmContract>(`/csm/contracts/${id}/renew`, body),
  slas: () => api.get<CsmSla[]>("/csm/slas"),
  createSla: (body: Record<string, unknown>) => api.post<CsmSla>("/csm/slas", body),
  updateSla: (id: number, body: Record<string, unknown>) => api.patch<CsmSla>(`/csm/slas/${id}`, body),
  escalations: () => api.get<CsmEscalation[]>("/csm/escalations"),
  createEscalation: (body: Record<string, unknown>) => api.post<CsmEscalation>("/csm/escalations", body),
  updateEscalation: (id: number, status: string) => api.patch<CsmEscalation>(`/csm/escalations/${id}`, { status }),
  majorCases: () => api.get<CsmMajorCase[]>("/csm/major-cases"),
  createMajorCase: (body: Record<string, unknown>) => api.post<CsmMajorCase>("/csm/major-cases", body),
  updateMajorCase: (id: number, body: { status: string; update?: string }) => api.patch<CsmMajorCase>(`/csm/major-cases/${id}`, body),
  views: () => api.get<CsmCaseView[]>("/csm/views"),
  createView: (body: { viewName: string; description?: string; filters: CsmCaseView["filters"]; isShared: boolean }) =>
    api.post<CsmCaseView>("/csm/views", body),
};
