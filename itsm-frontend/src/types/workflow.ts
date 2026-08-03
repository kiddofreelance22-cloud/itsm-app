export type StepType = "approval" | "task" | "notification";

export interface WorkflowStep {
  workflowStepId: number;
  stepName: string;
  stepOrder: number;
  stepType: StepType;
  approverRole: { roleId: number; roleName: string } | null;
}

export interface Workflow {
  workflowId: number;
  workflowName: string;
  description?: string;
  isActive: boolean;
  steps: WorkflowStep[];
}
