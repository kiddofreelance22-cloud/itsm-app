import { approvalApi, type ApprovalRequest } from "./configApi";
import { changeApi } from "./changeApi";
import { requestLifecycleApi, type ApprovalItem } from "./requestsApi";

export type ApprovalModule = "Incident" | "Service Request" | "Change";

export interface ApprovalHubItem {
  id: string;
  module: ApprovalModule;
  reference: string;
  title: string;
  description: string;
  requestedBy: string;
  requestedAt: string;
  status: string;
  href: string;
}

export interface ApprovalHubResult {
  items: ApprovalHubItem[];
  errors: string[];
}

const isWaiting = (status: string) =>
  ["pending", "awaiting me"].includes(status.toLowerCase());

function incidentItems(rows: ApprovalRequest[], endUser: boolean): ApprovalHubItem[] {
  return rows.map((row) => ({
    id: `incident-${row.approvalId}`,
    module: "Incident",
    reference: row.incidentRef,
    title: row.approvalType,
    description: row.shortDescription,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt,
    status: row.status,
    href: endUser
      ? `/my-incidents/${encodeURIComponent(row.incidentId)}`
      : `/incident-approvals/${row.approvalId}`,
  }));
}

function requestItems(rows: ApprovalItem[]): ApprovalHubItem[] {
  return rows.map((row) => ({
    id: `request-${row.requestId}-${row.levelNumber}`,
    module: "Service Request",
    reference: row.requestNumber,
    title: row.catalogName ?? "Service request",
    description: row.category ?? "",
    requestedBy: row.requestedBy ?? "—",
    requestedAt: row.createdAt,
    status: row.state,
    href: `/service-requests/approvals/${row.requestId}`,
  }));
}

function changeItems(rows: Awaited<ReturnType<typeof changeApi.myApprovals>>): ApprovalHubItem[] {
  return rows.flatMap((row) => row.change ? [{
    id: `change-${row.id}`,
    module: "Change",
    reference: row.change.changeCode,
    title: row.change.shortDescription,
    description: row.approvalGroup,
    requestedBy: row.change.requestedBy
      ? [row.change.requestedBy.firstName, row.change.requestedBy.lastName].filter(Boolean).join(" ") || row.change.requestedBy.username || "—"
      : "—",
    requestedAt: row.change.createdAt,
    status: row.status,
    href: `/changes/approvals/${row.id}`,
  }] : []);
}

export async function loadApprovalHub(endUser = false): Promise<ApprovalHubResult> {
  const [incidents, requests, changes] = await Promise.allSettled([
    approvalApi.list(),
    requestLifecycleApi.approvals(),
    changeApi.myApprovals(),
  ]);
  const errors: string[] = [];
  const items: ApprovalHubItem[] = [];

  if (incidents.status === "fulfilled") items.push(...incidentItems(incidents.value, endUser));
  else errors.push(`Incident approvals: ${incidents.reason instanceof Error ? incidents.reason.message : "Unable to load."}`);
  if (requests.status === "fulfilled") items.push(...requestItems(requests.value));
  else errors.push(`Service request approvals: ${requests.reason instanceof Error ? requests.reason.message : "Unable to load."}`);
  if (changes.status === "fulfilled") items.push(...changeItems(changes.value));
  else errors.push(`Change approvals: ${changes.reason instanceof Error ? changes.reason.message : "Unable to load."}`);

  items.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  return { items, errors };
}

export function isPendingApproval(item: ApprovalHubItem): boolean {
  return isWaiting(item.status);
}
