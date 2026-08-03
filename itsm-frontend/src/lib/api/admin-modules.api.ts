import { apiFetch } from "./client";
import { Status, Priority, Impact, Urgency, SubCategory, AssignmentGroup, Location } from "@/types/admin";

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
};

// ── Location ──────────────────────────────────────────────────────────────────
export const LocationApi = {
  list: () => apiFetch<Location[]>("/locations"),
  create: (body: object) => apiFetch<Location>("/locations", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: object) => apiFetch<Location>(`/locations/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/locations/${id}`, { method: "DELETE" }),
};
