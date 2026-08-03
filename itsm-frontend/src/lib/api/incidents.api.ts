import { apiFetch } from "./client";

export interface Incident {
  incidentId: string;
  title: string;
  description?: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  category: { categoryId: number; categoryName: string } | null;
  assignedTo: { userId: number; fullName: string } | null;
  createdBy: { userId: number; fullName: string };
  request: { requestId: number } | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CreateIncidentDto {
  title: string;
  description?: string;
  categoryId?: number;
  priority?: "Low" | "Medium" | "High" | "Critical";
  requestId?: number;
}

export interface UpdateIncidentDto {
  title?: string;
  description?: string;
  priority?: "Low" | "Medium" | "High" | "Critical";
  status?: "Open" | "In Progress" | "Resolved" | "Closed";
  assignedTo?: number;
}

export const IncidentsApi = {
  listMine: () => apiFetch<Incident[]>("/incidents/mine"),
  listAll: () => apiFetch<Incident[]>("/incidents"),
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
  remove: (id: string) =>
    apiFetch<void>(`/incidents/${id}`, { method: "DELETE" }),
};
