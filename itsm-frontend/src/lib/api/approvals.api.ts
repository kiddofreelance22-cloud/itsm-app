import { apiFetch } from "./client";
import { ServiceRequest } from "@/types/request";

export const ApprovalsApi = {
  listPending: () => apiFetch<ServiceRequest[]>("/approvals"),
  act: (
    requestId: number,
    action: "Approved" | "Rejected",
    comments?: string
  ) =>
    apiFetch<ServiceRequest>(`/approvals/${requestId}/action`, {
      method: "POST",
      body: JSON.stringify({ action, comments }),
    }),
};
