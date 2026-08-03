import { apiFetch } from "./client";
import { Workflow, WorkflowStep } from "@/types/workflow";

export interface CreateWorkflowDto {
  workflowName: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateStepDto {
  stepName: string;
  stepOrder: number;
  stepType: "approval" | "task" | "notification";
  approverRoleId?: number;
}

export const WorkflowsApi = {
  list: () => apiFetch<Workflow[]>("/workflows"),
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
};
