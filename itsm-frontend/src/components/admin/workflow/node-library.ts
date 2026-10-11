import type { NodeKindDef } from "./types";

// Every node type requested: triggers, HTTP/API, scripts, files, data ops,
// branching/looping, comms, and the existing ITSM approval/task steps.
// Outputs use semantic ids ("true"/"false"/"success"/"error"/"out") so the
// custom edge renderer can color + label them consistently.

export const NODE_LIBRARY: NodeKindDef[] = [
  // ---- Terminal ----
  { kind: "start", label: "Start", description: "Workflow entry point", category: "Terminal", icon: "Play", color: "emerald", backendStepType: "task", inputs: "none", outputs: [{ id: "out" }], configFields: [], terminal: true },
  { kind: "end", label: "End", description: "Workflow terminates here", category: "Terminal", icon: "Square", color: "rose", backendStepType: "task", inputs: "single", outputs: [], configFields: [], terminal: true },

  // ---- Triggers ----
  { kind: "trigger", label: "Trigger", description: "Manual / event trigger", category: "Triggers", icon: "Zap", color: "emerald", backendStepType: "task", inputs: "none", outputs: [{ id: "out" }], configFields: [
    { key: "eventName", label: "Event name", type: "text", placeholder: "request.created" },
  ] },
  { kind: "webhook", label: "Webhook", description: "Starts on an inbound HTTP call", category: "Triggers", icon: "Webhook", color: "emerald", backendStepType: "task", inputs: "none", outputs: [{ id: "out" }], configFields: [
    { key: "path", label: "Path", type: "text", placeholder: "/hooks/incoming" },
    { key: "method", label: "Method", type: "select", options: [{ value: "POST", label: "POST" }, { value: "GET", label: "GET" }], defaultValue: "POST" },
  ] },
  { kind: "cron", label: "Cron / Schedule", description: "Runs on a recurring schedule", category: "Triggers", icon: "Clock", color: "emerald", backendStepType: "wait", inputs: "none", outputs: [{ id: "out" }], configFields: [
    { key: "cronExpression", label: "Cron expression", type: "text", placeholder: "0 */6 * * *" },
    { key: "timezone", label: "Timezone", type: "text", placeholder: "UTC" },
  ] },

  // ---- Integrations / actions ----
  { kind: "httpRequest", label: "HTTP / API Request", description: "Call an external API", category: "Integrations", icon: "Globe", color: "blue", backendStepType: "task", inputs: "single", outputs: [{ id: "success", label: "success", color: "#16a34a" }, { id: "error", label: "error", color: "#dc2626" }], configFields: [
    { key: "method", label: "Method", type: "select", options: ["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({ value: m, label: m })), defaultValue: "GET" },
    { key: "url", label: "URL", type: "text", placeholder: "https://api.example.com/resource" },
    { key: "headers", label: "Headers (JSON)", type: "textarea", placeholder: '{\n  "Authorization": "Bearer ..."\n}' },
    { key: "body", label: "Body (JSON)", type: "textarea" },
  ] },
  { kind: "database", label: "Database", description: "Run a query", category: "Integrations", icon: "Database", color: "blue", backendStepType: "task", inputs: "single", outputs: [{ id: "success", label: "success", color: "#16a34a" }, { id: "error", label: "error", color: "#dc2626" }], configFields: [
    { key: "connection", label: "Connection", type: "text", placeholder: "primary" },
    { key: "query", label: "SQL", type: "code", placeholder: "SELECT * FROM tickets WHERE id = :id" },
  ] },
  { kind: "email", label: "Email", description: "Send an email", category: "Integrations", icon: "Mail", color: "blue", backendStepType: "notification", inputs: "single", outputs: [{ id: "out" }], configFields: [
    { key: "to", label: "To", type: "text", placeholder: "{{requester.email}}" },
    { key: "subject", label: "Subject", type: "text" },
    { key: "body", label: "Body", type: "textarea" },
  ] },
  { kind: "notification", label: "Notification", description: "In-app notification", category: "Integrations", icon: "Bell", color: "blue", backendStepType: "notification", inputs: "single", outputs: [{ id: "out" }], configFields: [
    { key: "message", label: "Message", type: "textarea" },
  ] },

  // ---- Code & files ----
  { kind: "code", label: "Code / JavaScript", description: "Run custom JS", category: "Code & Files", icon: "Code2", color: "amber", backendStepType: "task", inputs: "single", outputs: [{ id: "out" }], configFields: [
    { key: "script", label: "Script", type: "code", placeholder: "return { ...input, processed: true };" },
  ] },
  { kind: "shell", label: "Shell / Command", description: "Run a shell command", category: "Code & Files", icon: "Terminal", color: "amber", backendStepType: "task", inputs: "single", outputs: [{ id: "success", label: "success", color: "#16a34a" }, { id: "error", label: "error", color: "#dc2626" }], configFields: [
    { key: "command", label: "Command", type: "code", placeholder: "./process.sh {{file}}" },
  ] },
  { kind: "fileUpload", label: "File Upload", description: "Upload a file", category: "Code & Files", icon: "Upload", color: "amber", backendStepType: "task", inputs: "single", outputs: [{ id: "out" }], configFields: [
    { key: "destination", label: "Destination path", type: "text" },
  ] },
  { kind: "fileDownload", label: "File Download", description: "Download a file", category: "Code & Files", icon: "Download", color: "amber", backendStepType: "task", inputs: "single", outputs: [{ id: "out" }], configFields: [
    { key: "url", label: "Source URL", type: "text" },
  ] },
  { kind: "readFile", label: "Read File", description: "Read file contents", category: "Code & Files", icon: "FileText", color: "amber", backendStepType: "task", inputs: "single", outputs: [{ id: "out" }], configFields: [
    { key: "path", label: "Path", type: "text" },
  ] },
  { kind: "writeFile", label: "Write File", description: "Write file contents", category: "Code & Files", icon: "FilePlus", color: "amber", backendStepType: "task", inputs: "single", outputs: [{ id: "out" }], configFields: [
    { key: "path", label: "Path", type: "text" },
    { key: "content", label: "Content", type: "textarea" },
  ] },

  // ---- Data ----
  { kind: "transform", label: "Transform Data", description: "Reshape the payload", category: "Data", icon: "Wand2", color: "purple", backendStepType: "task", inputs: "single", outputs: [{ id: "out" }], configFields: [
    { key: "expression", label: "Expression", type: "code" },
  ] },
  { kind: "map", label: "Map Data", description: "Map fields item by item", category: "Data", icon: "Shuffle", color: "purple", backendStepType: "task", inputs: "single", outputs: [{ id: "out" }], configFields: [
    { key: "mapping", label: "Mapping (JSON)", type: "textarea" },
  ] },
  { kind: "filter", label: "Filter", description: "Keep items matching a condition", category: "Data", icon: "Filter", color: "purple", backendStepType: "task", inputs: "single", outputs: [{ id: "out" }], configFields: [
    { key: "condition", label: "Condition", type: "text" },
  ] },
  { kind: "merge", label: "Merge", description: "Join multiple branches", category: "Data", icon: "GitMerge", color: "purple", backendStepType: "task", inputs: "multiple", outputs: [{ id: "out" }], configFields: [
    { key: "strategy", label: "Strategy", type: "select", options: [{ value: "waitAll", label: "Wait for all" }, { value: "firstWins", label: "First to finish" }], defaultValue: "waitAll" },
  ] },
  { kind: "update", label: "Update Fields", description: "Set / update variables", category: "Data", icon: "Settings", color: "slate", backendStepType: "update", inputs: "single", outputs: [{ id: "out" }], configFields: [
    { key: "assignments", label: "Assignments (JSON)", type: "textarea" },
  ] },

  // ---- Control flow ----
  { kind: "condition", label: "Condition / IF", description: "Branch on a boolean expression", category: "Control Flow", icon: "GitBranch", color: "orange", backendStepType: "condition", inputs: "single", outputs: [{ id: "true", label: "true", color: "#16a34a" }, { id: "false", label: "false", color: "#dc2626" }], configFields: [
    { key: "expression", label: "Condition expression", type: "text", placeholder: "status equals approved" },
  ] },
  { kind: "switch", label: "Switch", description: "Branch on multiple cases", category: "Control Flow", icon: "SplitSquareHorizontal", color: "orange", backendStepType: "condition", inputs: "single", outputs: [{ id: "default", label: "default" }], dynamicOutputs: true, configFields: [
    { key: "expression", label: "Switch on", type: "text" },
  ] },
  { kind: "loop", label: "Loop", description: "Repeat over a collection", category: "Control Flow", icon: "Repeat", color: "orange", backendStepType: "task", inputs: "single", outputs: [{ id: "body", label: "loop", color: "#7c3aed" }, { id: "done", label: "done" }], configFields: [
    { key: "collection", label: "Collection", type: "text" },
    { key: "maxIterations", label: "Max iterations (safety limit)", type: "number", defaultValue: 1000 },
  ] },
  { kind: "delay", label: "Delay / Wait", description: "Pause before continuing", category: "Control Flow", icon: "Hourglass", color: "orange", backendStepType: "wait", inputs: "single", outputs: [{ id: "out" }], configFields: [
    { key: "durationSeconds", label: "Duration (seconds)", type: "number", defaultValue: 60 },
  ] },
  { kind: "retry", label: "Retry", description: "Retry the previous step on failure", category: "Control Flow", icon: "RotateCcw", color: "orange", backendStepType: "task", inputs: "single", outputs: [{ id: "out" }, { id: "giveUp", label: "give up", color: "#dc2626" }], configFields: [
    { key: "maxAttempts", label: "Max attempts", type: "number", defaultValue: 3 },
    { key: "backoffSeconds", label: "Backoff (seconds)", type: "number", defaultValue: 30 },
  ] },
  { kind: "subflow", label: "Subflow", description: "Call another workflow", category: "Control Flow", icon: "Workflow", color: "orange", backendStepType: "subflow", inputs: "single", outputs: [{ id: "out" }], configFields: [
    { key: "workflowId", label: "Workflow", type: "text" },
  ] },

  // ---- ITSM (existing execution semantics) ----
  { kind: "approval", label: "Approval", description: "Wait for human approval", category: "ITSM", icon: "CheckCircle2", color: "violet", backendStepType: "approval", inputs: "single", outputs: [{ id: "out" }], configFields: [
    { key: "approverRoleId", label: "Approver role ID", type: "number" },
  ] },
  { kind: "task", label: "Task", description: "Assign a manual task", category: "ITSM", icon: "ListChecks", color: "violet", backendStepType: "task", inputs: "single", outputs: [{ id: "out" }], configFields: [] },

  { kind: "custom", label: "Custom Node", description: "Generic custom step", category: "Other", icon: "Puzzle", color: "slate", backendStepType: "task", inputs: "single", outputs: [{ id: "out" }], configFields: [
    { key: "notes", label: "Notes", type: "textarea" },
  ] },
];

export const NODE_LIBRARY_BY_KIND: Record<string, NodeKindDef> = Object.fromEntries(
  NODE_LIBRARY.map((n) => [n.kind, n])
);

export const NODE_CATEGORIES: string[] = Array.from(new Set(NODE_LIBRARY.map((n) => n.category)));
