import { apiFetch } from "./client";

export interface DashboardCounter {
  total: number;
  open: number;
  inProgress: number;
  resolvedToday?: number;
  completedToday?: number;
  overdue?: number;
  pending?: number;
  approved?: number;
  mine?: number;
  mineOpen?: number;
  mineInProgress?: number;
  mineResolvedToday?: number;
  assignedOpen?: number;
  assignedInProgress?: number;
  assignedOnHold?: number;
  totalResolvedInWorkgroups?: number;
  totalInWorkgroups?: number;
  totalResolvedInAllWorkgroups?: number;
}

export interface DashboardTicketSummary {
  id: string;
  summary: string;
  priority: string;
  status: string;
  assignmentGroup: string;
  updatedAgo: string;
}

export interface AnalystDashboardStats {
  incidents: DashboardCounter;
  serviceRequests: DashboardCounter;
  problems: DashboardCounter;
  changes: DashboardCounter;
  tasks: { total: number; open: number; overdue: number };
  approvals: { total: number; pending: number; approved: number };
  unassigned: { total: number; incidents: number; serviceRequests: number; tasks: number };
  sla: { metPercent: number; met: number; breached: number; atRisk: number; total: number };
  byPriority: { priority: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byType: { type: string; count: number; percent: number }[];
  myOpenIncidents: DashboardTicketSummary[];
  myOpenRequests: DashboardTicketSummary[];
  unassignedByGroup: { groupId: number; groupName: string; incidentCount: number; requestCount: number }[];
}

export const DashboardApi = {
  getAnalystDashboard: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return apiFetch<AnalystDashboardStats>(`/dashboard/analyst${qs ? `?${qs}` : ""}`);
  },
};
