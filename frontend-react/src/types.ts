export type Role = "END_USER" | "RESOLVER" | "ADMIN";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Status = "NEW" | "ASSIGNED" | "IN_PROGRESS" | "PENDING" | "ON_HOLD" | "RESOLVED" | "CLOSED";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  roles: string[];
  workgroup: string | null;
}

export interface Incident {
  id: string;
  number: string;
  shortDescription: string;
  description: string | null;
  category: string | null;
  priority: Priority | null;
  status: Status;
  assignedWorkgroup: string | null;
  assignedWorkgroupId: number | null;
  assignedAgentId: string | null;
  resolutionNotes: string | null;
  closureCode: string | null;
  feedbackRating: number | null;
  feedbackComment: string | null;
  reportedById: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  // Extra display fields used by the Incident List column chooser / filters.
  priorityName?: string | null;
  statusName?: string | null;
  impact?: string | null;
  urgency?: string | null;
  assignedToName?: string | null;
  callerName?: string | null;
  location?: string | null;
  slaResolutionTarget?: string | null;
}

export interface IncidentMessage {
  id: string;
  incidentId: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  text: string;
  createdAt: string;
}

export interface FieldVisibility {
  fieldName: string;
  section: string;
  visible: boolean;
  required: boolean;
}

export interface Resolver {
  id: string;
  name: string;
  email: string;
  workgroup: string | null;
}
