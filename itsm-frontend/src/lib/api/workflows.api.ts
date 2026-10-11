import { apiFetch } from "./client";
import { ApprovalLevel, ApprovalLevelInput, Workflow, WorkflowStep } from "@/types/workflow";

export interface WorkflowActivityDefinition {
  type: "approval" | "task" | "notification" | "condition" | "wait" | "subflow" | "update";
  label: string;
  group: string;
}

export interface CreateWorkflowDto {
  workflowName: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateStepDto {
  stepName: string;
  stepOrder: number;
  stepType: "approval" | "task" | "notification" | "condition" | "wait" | "subflow" | "update";
  approverRoleId?: number;
  approvalLevels?: ApprovalLevelInput[];
}

export interface UpdateStepDto {
  stepName?: string;
  conditionExpression?: string;
  approverRoleId?: number | null;
  approvalLevels?: ApprovalLevelInput[];
}

export interface UpdateTransitionsDto {
  transitions: { branch: "yes" | "no"; targetStepId: number }[];
}

export interface ReorderStepDto {
  newOrder: number;
}

export const WorkflowsApi = {
  list: () => apiFetch<Workflow[]>("/workflows"),
  activityDefinitions: () => apiFetch<WorkflowActivityDefinition[]>("/workflows/activity-definitions"),
  getOne: (id: number) => apiFetch<Workflow>(`/workflows/${id}`),
  create: (body: CreateWorkflowDto) =>
    apiFetch<Workflow>("/workflows", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: number, body: Partial<CreateWorkflowDto>) =>
    apiFetch<Workflow>(`/workflows/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: number) =>
    apiFetch<void>(`/workflows/${id}`, { method: "DELETE" }),
  addStep: (id: number, body: CreateStepDto) =>
    apiFetch<WorkflowStep>(`/workflows/${id}/steps`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  removeStep: (id: number, stepId: number) =>
    apiFetch<void>(`/workflows/${id}/steps/${stepId}`, { method: "DELETE" }),
  updateStep: (id: number, stepId: number, body: UpdateStepDto) =>
    apiFetch<WorkflowStep>(`/workflows/${id}/steps/${stepId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  getApprovalLevels: (id: number, stepId: number) =>
    apiFetch<ApprovalLevel[]>(`/workflows/${id}/steps/${stepId}/approval-levels`),
  replaceApprovalLevels: (id: number, stepId: number, levels: ApprovalLevelInput[]) =>
    apiFetch<ApprovalLevel[]>(`/workflows/${id}/steps/${stepId}/approval-levels`, {
      method: "PUT",
      body: JSON.stringify({ levels }),
    }),
  updateTransitions: (id: number, stepId: number, body: UpdateTransitionsDto) =>
    apiFetch<Workflow>(`/workflows/${id}/steps/${stepId}/transitions`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  reorderStep: (id: number, stepId: number, body: ReorderStepDto) =>
    apiFetch<WorkflowStep>(`/workflows/${id}/steps/${stepId}/reorder`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};
