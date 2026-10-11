import type { ApprovalLevel } from "@/types/workflow";

// Shared type definitions for the visual workflow editor.
// This layer is additive: `backendStepType` maps every rich visual node kind
// down to the execution-relevant type your API already understands
// (approval | task | notification | condition | wait | subflow | update).
// New kinds you don't recognize on the backend yet all safely map to "task"
// with their real behaviour carried in `config` (see workflows.service.ts patch).

export type NodeKind =
  | "start"
  | "end"
  | "trigger"
  | "webhook"
  | "cron"
  | "httpRequest"
  | "code"
  | "shell"
  | "database"
  | "fileUpload"
  | "fileDownload"
  | "readFile"
  | "writeFile"
  | "transform"
  | "map"
  | "filter"
  | "merge"
  | "loop"
  | "delay"
  | "retry"
  | "email"
  | "notification"
  | "condition"
  | "switch"
  | "approval"
  | "task"
  | "subflow"
  | "update"
  | "custom";

export type BackendStepType =
  | "approval"
  | "task"
  | "notification"
  | "condition"
  | "wait"
  | "subflow"
  | "update";

export type ExecutionStatus = "idle" | "pending" | "running" | "success" | "failed" | "skipped" | "waiting";

export interface OutputHandleDef {
  id: string;
  label?: string;
  color?: string; // css color used for the handle + edge label chip
}

export type ConfigFieldType = "text" | "textarea" | "code" | "number" | "select" | "checkbox";

export interface ConfigFieldDef {
  key: string;
  label: string;
  type: ConfigFieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string | number | boolean;
}

export interface NodeKindDef {
  kind: NodeKind;
  label: string;
  description: string;
  category: string;
  icon: string; // lucide-react icon name, resolved via ICONS map
  color: string; // tailwind text/border color token, e.g. "blue"
  backendStepType: BackendStepType;
  inputs: "none" | "single" | "multiple";
  outputs: OutputHandleDef[]; // static default outputs (switch/loop add more dynamically)
  dynamicOutputs?: boolean; // switch nodes can add/remove case outputs
  configFields: ConfigFieldDef[];
  terminal?: boolean; // start/end — not draggable from palette
}

export interface WorkflowNodeData {
  [key: string]: unknown;
  kind: NodeKind;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  approvalLevels?: ApprovalLevel[];
  status: ExecutionStatus;
  durationMs?: number;
  errorMessage?: string;
  caseOutputs?: string[]; // for "switch" nodes: extra case labels beyond default
  collapsed?: boolean; // for group nodes
  stepId?: number; // backend id, absent for brand-new unsaved nodes
  isNew?: boolean;
}

export interface WorkflowEdgeData {
  [key: string]: unknown;
  label?: string;
  branch?: string; // e.g. "true" | "false" | case value | "success" | "error"
  animated?: boolean;
  status?: ExecutionStatus;
}
