import type { NodeKind } from "../components/admin/workflow/types";

export type StepType = "approval" | "task" | "notification" | "condition" | "wait" | "subflow" | "update";

export interface WorkflowTransition {
  transitionId: number;
  branch: "yes" | "no";
  fromStep: { workflowStepId: number; stepName: string };
  toStep: { workflowStepId: number; stepName: string } | null;
}

export interface WorkflowStep {
  workflowStepId: number;
  stepName: string;
  stepOrder: number;
  stepType: StepType;
  conditionExpression?: string | null;
  approverRole: { roleId: number; roleName: string } | null;
  nodeKind?: NodeKind;
  positionX?: number;
  positionY?: number;
  config?: Record<string, unknown>;
  approvalLevels?: ApprovalLevel[];
}

export interface Workflow {
  workflowId: number;
  workflowName: string;
  description?: string;
  isActive: boolean;
  status?: string;
  version?: number;
  associatedCatalogId?: number;
  requiresApproval?: boolean;
  approverRoleId?: number;
  steps?: WorkflowStep[];
  transitions?: WorkflowTransition[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ApprovalLevelInput {
  approvalLevelId?: number;
  levelNumber: number;
  title: string;
  approverType: "user" | "group" | "role" | "custom";
  approverId?: number | null;
  autoApproval: boolean;
  emailNotificationsForEndUser: boolean;
  referBackToRequestor: boolean;
  referBackToPreviousApprovers: boolean;
  customGroupId?: number | null;
}

export interface ApprovalLevel extends ApprovalLevelInput {
  activityId?: number;
  customGroup?: { groupId: number; groupName: string } | null;
  createdAt?: string;
}

export interface WorkflowTask {
  workflowTaskId: number;
  activityId: number;
  taskName: string;
  description?: string;
  assigneeType: string;
  assigneeId?: number;
  dueDateHours?: number;
  priority: string;
  checklists?: Record<string, unknown>;
  createdAt: string;
}

export interface WorkflowNotification {
  workflowNotificationId: number;
  activityId: number;
  notificationName: string;
  recipientType: string;
  recipientIds?: Record<string, unknown>;
  subject?: string;
  body?: string;
  triggerEvents?: Record<string, unknown>;
  attachmentIds?: Record<string, unknown>;
  createdAt: string;
}

export interface WorkflowCondition {
  workflowConditionId: number;
  activityId: number;
  conditionName: string;
  expression: string;
  truePathActivityId?: number;
  falsePathActivityId?: number;
  createdAt: string;
}

export interface ServiceRequestFlowTracking {
  trackingId: number;
  serviceRequestId: number;
  catalogId: number;
  workflowId?: number;
  currentActivityId?: number;
  currentStep: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowExecutionLog {
  executionLogId: number;
  workflowId: number;
  serviceRequestId?: number;
  activityId?: number;
  action: string;
  performedById?: number;
  result?: string;
  errorMessage?: string;
  executionTimeMs?: number;
  createdAt: string;
}
