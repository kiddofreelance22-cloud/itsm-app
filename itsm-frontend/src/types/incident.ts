export type IncidentStatus =
  | "Assigned"
  | "In Progress"
  | "Resolved"
  | "Closed"
  | "On Hold";

export type IncidentPriority = "Low" | "Medium" | "High" | "Critical";

export interface Incident {
  id: string; // e.g. INC000125
  summary: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  impact: "Low" | "Medium" | "High";
  urgency: "Low" | "Medium" | "High";
  category: string;
  subCategory: string;
  assignmentGroup: string;
  assignedTo: string;
  location: string;
  affectedAsset: string;
  caller: string;
  contactNumber: string;
  emailId: string;
  department: string;
  businessService: string;
  sla: {
    responseTarget: string;
    resolutionTarget: string;
    status: "Within SLA" | "Breached" | "At Risk";
    respondedIn?: string;
    responseMet: boolean;
    timeElapsed: string;
    percentElapsed: number;
  };
  attachments: { name: string; size: string }[];
  timeline: TimelineEvent[];
  conversation: ConversationMessage[];
  createdOn: string;
  updatedOn: string;
  createdBy: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  actor: string;
  timestamp: string;
  icon: "created" | "assigned" | "started" | "update" | "resolved" | "reopened";
}

export interface ConversationMessage {
  id: string;
  author: string;
  timestamp: string;
  message: string;
}

export interface IncidentListItem
  extends Pick<
    Incident,
    "id" | "summary" | "status" | "priority" | "assignmentGroup"
  > {
  createdOn: string;
  updatedOn: string;
}
