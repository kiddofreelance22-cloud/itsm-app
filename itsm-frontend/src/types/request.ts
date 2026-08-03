export type RequestStatus =
  | "Submitted"
  | "In Progress"
  | "Approved"
  | "Rejected"
  | "Closed";

export interface RequestVariableValue {
  variable: { variableId: number; label: string };
  value: string;
}

export interface ServiceRequest {
  requestId: number;
  catalog: { catalogId: number; catalogName: string };
  requestedBy: { userId: number; fullName: string };
  status: RequestStatus;
  currentStep: { workflowStepId: number; stepName: string } | null;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  variableValues: RequestVariableValue[];
}
