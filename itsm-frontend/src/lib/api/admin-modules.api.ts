import { apiFetch } from "./client";
import { Status, Priority, Impact, Urgency, SubCategory, AssignmentGroup, Location, ServiceCategory, ServiceImpact, ServicePriority, ServiceUrgency, RequestSlaServiceWindow, ServiceCompletion, ClosureCode, PendingReason, RequestPendingReason, PriorityMatrix, SlaServiceWindow } from "@/types/admin";

// ── Status ────────────────────────────────────────────────────────────────────
export const StatusApi = {
  list: () => apiFetch<Status[]>("/status"),
  create: (body: object) => apiFetch<Status>("/status", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<Status>(`/status/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/status/${id}`, { method: "DELETE" }),
};

// ── Priority ──────────────────────────────────────────────────────────────────
export const PriorityApi = {
  list: () => apiFetch<Priority[]>("/priority"),
  create: (body: object) => apiFetch<Priority>("/priority", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<Priority>(`/priority/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/priority/${id}`, { method: "DELETE" }),
};

// ── Impact ────────────────────────────────────────────────────────────────────
export const ImpactApi = {
  list: () => apiFetch<Impact[]>("/impact"),
  create: (body: object) => apiFetch<Impact>("/impact", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<Impact>(`/impact/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/impact/${id}`, { method: "DELETE" }),
};

// ── Urgency ───────────────────────────────────────────────────────────────────
export const UrgencyApi = {
  list: () => apiFetch<Urgency[]>("/urgency"),
  create: (body: object) => apiFetch<Urgency>("/urgency", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<Urgency>(`/urgency/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/urgency/${id}`, { method: "DELETE" }),
};

// ── Sub-Category ──────────────────────────────────────────────────────────────
export const SubCategoryApi = {
  list: () => apiFetch<SubCategory[]>("/sub-category"),
  create: (body: object) => apiFetch<SubCategory>("/sub-category", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<SubCategory>(`/sub-category/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/sub-category/${id}`, { method: "DELETE" }),
};

// ── Assignment Group ──────────────────────────────────────────────────────────
export const AssignmentGroupApi = {
  list: () => apiFetch<AssignmentGroup[]>("/assignment-groups"),
  create: (body: object) => apiFetch<AssignmentGroup>("/assignment-groups", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<AssignmentGroup>(`/assignment-groups/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/assignment-groups/${id}`, { method: "DELETE" }),
  addMember: (groupId: number, userId: number) =>
    apiFetch<AssignmentGroup>(`/assignment-groups/${groupId}/members/${userId}`, { method: "POST" }),
  removeMember: (groupId: number, userId: number) =>
    apiFetch<AssignmentGroup>(`/assignment-groups/${groupId}/members/${userId}`, { method: "DELETE" }),
  /** Workgroups the current user belongs to, with real assigned-to-me / total incident counts. */
  myWorkgroups: () =>
    apiFetch<MyWorkgroup[]>("/assignment-groups/my-workgroups"),
};

export interface MyWorkgroup {
  groupId: number;
  groupName: string;
  groupCode: string;
  assignedToMe: number;
  totalIncidents: number;
  resolvedTickets: number;
}

// ── Location ──────────────────────────────────────────────────────────────────
export const LocationApi = {
  list: () => apiFetch<Location[]>("/locations"),
  create: (body: object) => apiFetch<Location>("/locations", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<Location>(`/locations/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/locations/${id}`, { method: "DELETE" }),
};

// ── Service request masters ─────────────────────────────────────────────────
export const ServiceCategoryApi = {
  list: () => apiFetch<ServiceCategory[]>("/service-categories"),
  create: (body: object) => apiFetch<ServiceCategory>("/service-categories", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<ServiceCategory>(`/service-categories/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/service-categories/${id}`, { method: "DELETE" }),
};
export const ServiceImpactApi = {
  list: () => apiFetch<ServiceImpact[]>("/service-impacts"),
  create: (body: object) => apiFetch<ServiceImpact>("/service-impacts", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<ServiceImpact>(`/service-impacts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/service-impacts/${id}`, { method: "DELETE" }),
};
export const ServiceCompletionApi = {
  list: () => apiFetch<ServiceCompletion[]>("/service-completions"),
  create: (body: object) => apiFetch<ServiceCompletion>("/service-completions", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<ServiceCompletion>(`/service-completions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/service-completions/${id}`, { method: "DELETE" }),
};

export const ClosureCodeApi = {
  list: () => apiFetch<ClosureCode[]>("/closure-codes"),
  create: (body: object) => apiFetch<ClosureCode>("/closure-codes", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<ClosureCode>(`/closure-codes/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/closure-codes/${id}`, { method: "DELETE" }),
};
export const PendingReasonApi = {
  list: () => apiFetch<PendingReason[]>("/pending-reasons"),
  create: (body: object) => apiFetch<PendingReason>("/pending-reasons", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<PendingReason>(`/pending-reasons/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/pending-reasons/${id}`, { method: "DELETE" }),
};
export const RequestPendingReasonApi = {
  list: () => apiFetch<RequestPendingReason[]>("/request-pending-reasons"),
  create: (body: object) => apiFetch<RequestPendingReason>("/request-pending-reasons", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<RequestPendingReason>(`/request-pending-reasons/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/request-pending-reasons/${id}`, { method: "DELETE" }),
};
export const PriorityMatrixApi = {
  list: () => apiFetch<PriorityMatrix[]>("/priority-matrices"),
  create: (body: object) => apiFetch<PriorityMatrix>("/priority-matrices", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<PriorityMatrix>(`/priority-matrices/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/priority-matrices/${id}`, { method: "DELETE" }),
};
export const SlaServiceWindowApi = {
  list: () => apiFetch<SlaServiceWindow[]>("/sla-service-windows"),
  create: (body: object) => apiFetch<SlaServiceWindow>("/sla-service-windows", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<SlaServiceWindow>(`/sla-service-windows/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/sla-service-windows/${id}`, { method: "DELETE" }),
};
export const ServicePriorityApi = {
  list: () => apiFetch<ServicePriority[]>("/service-priorities"),
  create: (body: object) => apiFetch<ServicePriority>("/service-priorities", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<ServicePriority>(`/service-priorities/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/service-priorities/${id}`, { method: "DELETE" }),
};
export const ServiceUrgencyApi = {
  list: () => apiFetch<ServiceUrgency[]>("/service-urgencies"),
  create: (body: object) => apiFetch<ServiceUrgency>("/service-urgencies", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<ServiceUrgency>(`/service-urgencies/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/service-urgencies/${id}`, { method: "DELETE" }),
};
export const RequestSlaServiceWindowApi = {
  list: () => apiFetch<RequestSlaServiceWindow[]>("/request-sla-service-windows"),
  create: (body: object) => apiFetch<RequestSlaServiceWindow>("/request-sla-service-windows", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<RequestSlaServiceWindow>(`/request-sla-service-windows/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/request-sla-service-windows/${id}`, { method: "DELETE" }),
};
