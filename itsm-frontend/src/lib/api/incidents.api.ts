import { apiFetch } from "./client";

export interface AssignmentGroup {
  groupId: number;
  groupName: string;
  groupCode: string;
}

export interface Incident {
  incidentId: string;
  incidentCode?: string;
  title: string;
  description?: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  impact?: "Low" | "Medium" | "High";
  urgency?: "Low" | "Medium" | "High";
  status: "Open" | "Assigned" | "In Progress" | "On Hold" | "Resolved" | "Closed";
  category: { categoryId: number; categoryName: string } | null;
  subCategory?: { subCategoryId: number; subCategoryName: string } | null;
  assignmentGroup: AssignmentGroup | null;
  assignedTo: { userId: number; fullName: string; email?: string } | null;
  createdBy: { userId: number; fullName: string; email?: string };
  request: { requestId: number } | null;
  location?: { locationId: number; locationName: string } | null;
  affectedAsset?: string;
  businessService?: string;
  contactNumber?: string;
  department?: string;
  slaResponseTarget?: string | null;
  slaResolutionTarget?: string | null;
  slaResponseMet?: boolean;
  slaBreached?: boolean;
  createdAt: string;
  updatedAt?: string;
  resolvedAt: string | null;
  claimedAt?: string | null;
}

export interface IncidentActivity {
  activityId: number;
  incidentId: string;
  type: "comment" | "work_note" | "status_change" | "assignment_change" | "priority_change" | "urgency_change" | "impact_change" | "claimed" | "created";
  content: string | null;
  meta: Record<string, unknown> | null;
  isWorkNote: boolean;
  author: { userId: number; fullName: string } | null;
  createdAt: string;
}

export interface CreateIncidentDto {
  title: string;
  description?: string;
  categoryId?: number;
  subCategoryId?: number;
  priority?: "Low" | "Medium" | "High" | "Critical";
  impact?: "Low" | "Medium" | "High";
  urgency?: "Low" | "Medium" | "High";
  assignmentGroupId?: number;
  contactNumber?: string;
  department?: string;
  affectedAsset?: string;
  businessService?: string;
  locationId?: number;
  requestId?: number;
}

export interface UpdateIncidentDto {
  title?: string;
  description?: string;
  priority?: "Low" | "Medium" | "High" | "Critical";
  impact?: string;
  urgency?: string;
  status?: "Open" | "Assigned" | "In Progress" | "On Hold" | "Resolved" | "Closed";
  assignedTo?: number | null;
  categoryId?: number;
  subCategoryId?: number;
  groupId?: number | null;
  locationId?: number;
  affectedAsset?: string;
  businessService?: string;
  contactNumber?: string;
  department?: string;
}

export interface ResolveIncidentDto {
  resolutionCode: string;
  resolutionNotes: string;
  additionalComments?: string;
  resolutionCategory?: string;
  resolutionSubcategory?: string;
}

export interface AdminIncidentListFilters {
  search?: string;
  status?: string;
  priority?: string;
  impact?: string;
  urgency?: string;
  categoryId?: number | string;
  subCategoryId?: number | string;
  assignmentGroupId?: number | string;
  assignedToId?: number | string;
  createdById?: number | string;
  locationId?: number | string;
  createdFrom?: string;
  createdTo?: string;
  slaBreached?: boolean;
}

function buildIncidentQuery(filters: AdminIncidentListFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "All") params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const IncidentsApi = {
  listMine: () => apiFetch<Incident[]>("/incidents/mine"),
  listAll: () => apiFetch<Incident[]>("/incidents"),
  listAdmin: (filters?: AdminIncidentListFilters) =>
    apiFetch<Incident[]>(`/incidents/admin-list${buildIncidentQuery(filters)}`),
  listAssignedToMe: () => apiFetch<Incident[]>("/incidents/assigned-to-me"),
  listWorkgroup: () => apiFetch<Incident[]>("/incidents/workgroup"),
  listGroupQueue: (groupId: number) =>
    apiFetch<Incident[]>(`/incidents/queue/${groupId}`),
  getOne: (id: string) => apiFetch<Incident>(`/incidents/${id}`),
  create: (body: CreateIncidentDto) =>
    apiFetch<Incident>("/incidents", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: UpdateIncidentDto) =>
    apiFetch<Incident>(`/incidents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  claim: (id: string) =>
    apiFetch<Incident>(`/incidents/${id}/claim`, { method: "POST" }),
  release: (id: string) =>
    apiFetch<Incident>(`/incidents/${id}/release`, { method: "POST" }),
  assignGroup: (id: string, assignmentGroupId: number) =>
    apiFetch<Incident>(`/incidents/${id}/assignment-group`, {
      method: "PATCH",
      body: JSON.stringify({ assignmentGroupId }),
    }),
  resolve: (id: string, body: ResolveIncidentDto) =>
    apiFetch<Incident>(`/incidents/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    apiFetch<void>(`/incidents/${id}`, { method: "DELETE" }),
  getActivities: (id: string) =>
    apiFetch<IncidentActivity[]>(`/incidents/${id}/activities`),
  addActivity: (id: string, body: { content: string; isWorkNote?: boolean }) =>
    apiFetch<IncidentActivity>(`/incidents/${id}/activities`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
