import { api, setToken } from "./api";
import type { FieldVisibility, Incident, IncidentMessage, Priority, Resolver, Role, Status, User } from "./types";

interface BackendUser {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  roles?: string[];
  phone?: string;
}

interface BackendIncident {
  incidentId: string;
  incidentCode?: string | null;
  title: string;
  description?: string | null;
  category?: { categoryName: string } | null;
  priority?: string | null;
  status: string;
  assignmentGroup?: { groupId: number; groupName: string } | null;
  assignedTo?: { userId: number; fullName?: string } | null;
  createdBy?: { userId: number; fullName?: string } | null;
  impact?: string | null;
  urgency?: string | null;
  location?: { locationName?: string } | null;
  slaResolutionTarget?: string | null;
  resolutionNotes?: string | null;
  closureCode?: string | null;
  feedbackRating?: number | null;
  feedbackComment?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
}

interface BackendActivity {
  activityId: number;
  author?: { userId: number; fullName: string } | null;
  content: string | null;
  createdAt: string;
}

interface BackendGroup {
  groupId: number;
  groupName: string;
  isActive?: boolean;
  members?: BackendUser[];
}

interface MyWorkgroup {
  groupId: number;
  groupName: string;
  groupCode: string;
  assignedToMe: number;
  totalIncidents: number;
  resolvedTickets: number;
}

interface BackendCategory {
  categoryId: number;
  categoryName: string;
  isActive?: boolean;
}

function normalizeRole(roles: string[] = []): Role {
  if (roles.some((role) => ["Admin", "Administrator"].includes(role))) return "ADMIN";
  // Admin-defined roles ("IT Engineer", "L2 Support Analyst", ...) have free-form names,
  // so match on the words that make a role a resolver. Keep in sync with roles.util.ts in the backend.
  if (roles.some((role) => /(engineer|agent|analyst|support|resolver|fulfiller|technician|specialist|desk|manager)/i.test(role))) {
    return "RESOLVER";
  }
  return "END_USER";
}

function mapUser(raw: BackendUser): User {
  const roles = raw.roles ?? [];
  return {
    id: String(raw.userId),
    email: raw.email,
    name: raw.fullName,
    role: normalizeRole(roles),
    roles,
    workgroup: null,
  };
}

function mapPriority(priority?: string | null): Priority | null {
  const value = priority?.toUpperCase();
  return value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "CRITICAL" ? value : null;
}

function mapStatus(status: string): Status {
  const s = status.toLowerCase().trim();
  if (s.startsWith("pending")) return "PENDING";
  switch (s) {
    case "assigned":
      return "ASSIGNED";
    case "in progress":
      return "IN_PROGRESS";
    case "on hold":
      return "ON_HOLD";
    case "resolved":
      return "RESOLVED";
    case "closed":
    case "cancelled":
      return "CLOSED";
    default:
      return "NEW";
  }
}

function mapIncident(raw: BackendIncident): Incident {
  return {
    id: raw.incidentId,
    number: raw.incidentCode || raw.incidentId,
    shortDescription: raw.title,
    description: raw.description ?? null,
    category: raw.category?.categoryName ?? null,
    priority: mapPriority(raw.priority),
    status: mapStatus(raw.status),
    assignedWorkgroup: raw.assignmentGroup?.groupName ?? null,
    assignedWorkgroupId: raw.assignmentGroup?.groupId ?? null,
    assignedAgentId: raw.assignedTo ? String(raw.assignedTo.userId) : null,
    resolutionNotes: raw.resolutionNotes ?? null,
    closureCode: raw.closureCode ?? null,
    feedbackRating: raw.feedbackRating ?? null,
    feedbackComment: raw.feedbackComment ?? null,
    reportedById: String(raw.createdBy?.userId ?? ""),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    resolvedAt: raw.resolvedAt ?? null,
    closedAt: raw.closedAt ?? null,
    priorityName: raw.priority ?? null,
    statusName: raw.status ?? null,
    impact: raw.impact ?? null,
    urgency: raw.urgency ?? null,
    assignedToName: raw.assignedTo?.fullName ?? null,
    callerName: raw.createdBy?.fullName ?? null,
    location: raw.location?.locationName ?? null,
    slaResolutionTarget: raw.slaResolutionTarget ?? null,
  };
}

function toBackendStatus(status: Status): string {
  return {
    NEW: "Open",
    ASSIGNED: "Assigned",
    IN_PROGRESS: "In Progress",
    PENDING: "Pending Customer",
    ON_HOLD: "On Hold",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
  }[status];
}

export const incidentApi = {
  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    const result = await api.post<{ accessToken: string; user: BackendUser }>("/auth/login", { username, password });
    return { token: result.accessToken, user: mapUser(result.user) };
  },

  /** Completes "Sign in with Microsoft": swaps the one-time code from the redirect for a normal session. */
  async ssoExchange(code: string): Promise<{ token: string; user: User }> {
    const result = await api.post<{ accessToken: string; user: BackendUser }>("/auth/sso/exchange", { code });
    return { token: result.accessToken, user: mapUser(result.user) };
  },

  async ssoEnabled(): Promise<boolean> {
    try { return !!(await api.get<{ enabled: boolean }>("/auth/sso/azure/config")).enabled; } catch { return false; }
  },

  async resetTemporaryPassword(email: string, temporaryPassword: string, newPassword: string): Promise<{ token: string; user: User }> {
    const result = await api.post<{ accessToken: string; user: BackendUser }>("/auth/reset-temp-password", {
      email,
      temporaryPassword,
      newPassword,
    });
    return { token: result.accessToken, user: mapUser(result.user) };
  },

  async currentUser(): Promise<{ user: User }> {
    const result = await api.get<BackendUser>("/auth/me");
    return { user: mapUser(result) };
  },

  async createIncident(input: { shortDescription: string; description: string; categoryId: number | null; priority: Priority }) {
    const raw = await api.post<BackendIncident>("/incidents", {
      title: input.shortDescription,
      description: input.description,
      categoryId: input.categoryId ?? undefined,
      priority: input.priority[0] + input.priority.slice(1).toLowerCase(),
    });
    return { incident: mapIncident(raw) };
  },

  async myIncidents() {
    const raw = await api.get<BackendIncident[]>("/incidents/mine");
    return { incidents: raw.map(mapIncident) };
  },

  async allIncidents(roles: string[]) {
    const route = roles.some((role) => ["Admin", "Administrator"].includes(role))
      ? "/incidents/admin-list"
      : "/incidents/workgroup";
    const raw = await api.get<BackendIncident[]>(route);
    return { incidents: raw.map(mapIncident) };
  },

  async assignedToMe() {
    const raw = await api.get<BackendIncident[]>("/incidents/assigned-to-me");
    return raw.map(mapIncident);
  },

  async groupQueue(groupId: number) {
    const raw = await api.get<BackendIncident[]>(`/incidents/queue/${groupId}`);
    return raw.map(mapIncident);
  },

  async claimIncident(id: string) {
    const raw = await api.post<BackendIncident>(`/incidents/${encodeURIComponent(id)}/claim`);
    return mapIncident(raw);
  },

  async releaseIncident(id: string) {
    const raw = await api.post<BackendIncident>(`/incidents/${encodeURIComponent(id)}/release`);
    return mapIncident(raw);
  },

  async getIncident(id: string) {
    const raw = await api.get<BackendIncident>(`/incidents/${encodeURIComponent(id)}`);
    return { incident: mapIncident(raw) };
  },

  async updateIncident(id: string, data: Partial<{
    status: Status;
    priority: Priority;
    assignedWorkgroupId: number | null;
    assignedAgentId: string | null;
    resolutionNotes: string | null;
    closureCode: string | null;
    feedbackRating: number | null;
    onHoldReason: string | null;
  }>) {
    const body: Record<string, unknown> = {};
    if (data.status) body.status = toBackendStatus(data.status);
    if (data.priority) body.priority = data.priority[0] + data.priority.slice(1).toLowerCase();
    if (data.assignedWorkgroupId !== undefined) body.groupId = data.assignedWorkgroupId;
    if (data.assignedAgentId !== undefined) body.assignedTo = data.assignedAgentId ? Number(data.assignedAgentId) : null;
    if (data.resolutionNotes !== undefined) body.resolutionNotes = data.resolutionNotes;
    if (data.closureCode !== undefined) body.closureCode = data.closureCode;
    if (data.feedbackRating !== undefined) body.feedbackRating = data.feedbackRating;
    if (data.onHoldReason !== undefined) body.onHoldReason = data.onHoldReason;
    const raw = await api.patch<BackendIncident>(`/incidents/${encodeURIComponent(id)}`, body);
    return { incident: mapIncident(raw) };
  },

  async closeIncident(id: string, feedbackRating?: number) {
    return this.updateIncident(id, {
      status: "CLOSED",
      ...(feedbackRating ? { feedbackRating } : {}),
    });
  },

  async reopenIncident(id: string) {
    return this.updateIncident(id, { status: "NEW" });
  },

  async messages(id: string) {
    const activities = await api.get<BackendActivity[]>(`/incidents/${encodeURIComponent(id)}/activities`);
    const messages: IncidentMessage[] = activities
      .filter((activity) => activity.content)
      .map((activity) => ({
        id: String(activity.activityId),
        incidentId: id,
        authorId: String(activity.author?.userId ?? ""),
        authorName: activity.author?.fullName ?? "System",
        authorRole: "END_USER",
        text: activity.content ?? "",
        createdAt: activity.createdAt,
      }));
    return { messages };
  },

  async addMessage(id: string, text: string) {
    return api.post(`/incidents/${encodeURIComponent(id)}/activities`, { content: text, isWorkNote: false });
  },

  async categories() {
    const categories = await api.get<BackendCategory[]>("/categories");
    return categories.filter((category) => category.isActive !== false);
  },

  async assignmentGroups() {
    return api.get<BackendGroup[]>("/assignment-groups");
  },

  async myWorkgroups() {
    return api.get<MyWorkgroup[]>("/assignment-groups/my-workgroups");
  },

  async resolvers(): Promise<{ resolvers: Resolver[] }> {
    const groups = await this.assignmentGroups();
    const resolvers = new Map<string, Resolver>();
    groups.forEach((group) => group.members?.forEach((member) => {
      resolvers.set(String(member.userId), {
        id: String(member.userId),
        name: member.fullName,
        email: member.email,
        workgroup: group.groupName,
      });
    }));
    return { resolvers: [...resolvers.values()] };
  },

  async fieldVisibility() {
    return api.get<{ fields: FieldVisibility[] }>("/incidents/meta/field-visibility");
  },

  async saveFieldVisibility(fields: FieldVisibility[]) {
    return api.put<{ fields: FieldVisibility[] }>("/config/field-visibility", {
      fields: fields.map((field) => ({
        field_name: field.fieldName,
        section: field.section,
        visible: field.visible,
        required: field.required,
      })),
    });
  },
};

export function clearSession(): void {
  setToken(null);
}