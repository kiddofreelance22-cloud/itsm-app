import { api } from "./api";

export interface EndUserRow {
  incidentId: string; id: string; shortDescription: string; priority: string; status: string;
  assignedWorkgroup: string; reported: string; rating: number; resolvedAt?: string;
}
export interface EndUserDashboard {
  stats: { total: number; open: number; resolved: number; needsFeedback: number };
  openTickets: EndUserRow[];
  recentlyClosed: EndUserRow[];
  needsFeedback: EndUserRow[];
}

export interface ResolverRow {
  incidentId: string; id: string; shortDescription: string; priority: string; status: string;
  sla: string; assignmentGroup: string; assignedTo: string; updatedAt: string; updatedAgo: string;
}
export interface ResolverDashboard {
  stats: { assignedToMe: number; myOpen: number; slaPaused: number; unassigned: number };
  myQueue: ResolverRow[];
  unassigned: ResolverRow[];
  slaAttention: { incidentId: string; id: string; shortDescription: string; reason: string }[];
  groups: { groupId: number; groupName: string }[];
}

export interface PendingApproval {
  requestId: number;
  approvalStage: "workflow" | "step";
  createdAt: string;
  catalog?: { catalogName?: string } | null;
  requestedBy?: { fullName?: string } | null;
}

export interface AnalystDashboardStats {
  incidents: {
    total: number;
    open: number;
    inProgress: number;
    mineOpen?: number;
    totalInWorkgroups?: number;
    totalResolvedInAllWorkgroups?: number;
  };
  serviceRequests: { total: number; open: number; inProgress: number; completedToday?: number };
  problems: { total: number; open: number; inProgress: number };
  changes: { total: number; open: number; inProgress: number };
  tasks: { total: number; open: number; overdue: number };
  approvals: { total: number; pending: number; approved: number };
  sla: { metPercent: number; met: number; breached: number; atRisk: number; total: number };
  byPriority: { priority: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byType: { type: string; count: number; percent: number }[];
  myOpenIncidents: {
    id: string; summary: string; priority: string; priorityColor?: string | null; status: string; assignmentGroup: string; updatedAgo: string;
  }[];
  myOpenRequests: {
    id: string; summary: string; priority: string; priorityColor?: string | null; status: string; assignmentGroup: string; updatedAgo: string;
  }[];
  unassignedByGroup: { groupId: number; groupName: string; incidentCount: number; requestCount: number }[];
}

export interface AdminDashboard {
  stats: {
    totalIncidents: number; openIncidents: number; unassignedIncidents: number; resolvedToday: number;
    slaBreached: number; slaCompliance: number; activeUsers: number; totalUsers: number; totalGroups: number;
    avgRating: number | null; ratingCount: number;
  };
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  byGroup: { groupName: string; count: number }[];
  trend: { day: string; created: number; resolved: number }[];
  recent: {
    incidentId: string; id: string; shortDescription: string; priority: string; status: string;
    assignmentGroup: string; assignedTo: string; createdAt: string;
  }[];
}

export const dashboardApi = {
  endUser: () => api.get<EndUserDashboard>("/dashboard/end-user"),
  analyst: () => api.get<AnalystDashboardStats>("/dashboard/analyst"),
  resolver: () => api.get<ResolverDashboard>("/dashboard/resolver"),
  admin: () => api.get<AdminDashboard>("/dashboard/admin"),
  pendingApprovals: () => api.get<PendingApproval[]>("/approvals"),
};
