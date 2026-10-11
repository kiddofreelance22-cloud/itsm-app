"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, useReactFlow, MarkerType, SelectionMode,
  type Node, type Edge, type Connection, type OnConnect, type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Maximize2, ZoomIn, ZoomOut, RotateCcw, RotateCw, Save, Play, Trash2,
  LayoutGrid, ChevronDown, Info, X, AlertTriangle,
  Group as GroupIcon, Ungroup, CheckCircle2, ListChecks, Bell, GitBranch,
} from "lucide-react";
import { WorkflowStep, WorkflowTransition } from "@/types/workflow";
import type { ApprovalLevel, ApprovalLevelInput } from "@/types/workflow";
import type { Role, AssignmentGroup } from "@/types/admin";
import { NODE_LIBRARY, NODE_LIBRARY_BY_KIND } from "./workflow/node-library";
import { ApprovalPropertiesDialog } from "./workflow/approval-properties-dialog";
import { WORKFLOW_NODE_TYPES } from "./workflow/custom-node";
import { WORKFLOW_EDGE_TYPES } from "./workflow/custom-edge";
import { autoLayout, type LayoutMode } from "./workflow/layout";
import type { NodeKind, WorkflowNodeData, WorkflowEdgeData, ExecutionStatus } from "./workflow/types";

// ---------------------------------------------------------------------------
// NOTE ON SCOPE
// This is a from-scratch React Flow (@xyflow/react) rebuild of the workflow
// canvas: smart orthogonal auto-routed edges, the full requested node
// palette, drag/drop + right-click + insert-on-edge node creation, dagre
// auto-layout (4 modes), multi-select/undo-redo/copy-paste/duplicate,
// execution-state visualization, light group/collapse support, and a
// validation panel. Persistence still writes through your existing
// per-step API (onAddStep/onUpdateStep/onRemoveStep/onUpdateTransitions) so
// it works against your current backend unchanged; pass the new
// `onSaveGraph` prop (see bottom of this file) once you've applied the
// backend patch to get full-fidelity save of node kind/config/position for
// every node type, not just the ITSM approval/task/condition set.
// ---------------------------------------------------------------------------

type WFNode = Node<WorkflowNodeData>;
type WFEdge = Edge<WorkflowEdgeData>;

interface WorkflowEditorProps {
  workflowId: number;
  workflowName: string;
  steps?: WorkflowStep[];
  transitions?: WorkflowTransition[];
  roles?: Role[];
  assignmentGroups?: AssignmentGroup[];
  onAddStep?: (workflowId: number, body: { stepName: string; stepOrder: number; stepType: "approval" | "task" | "notification" | "condition" | "wait" | "subflow" | "update"; approverRoleId?: number; approvalLevels?: ApprovalLevelInput[] }) => Promise<WorkflowStep | null>;
  onRemoveStep?: (workflowId: number, stepId: number) => Promise<boolean>;
  onUpdateStep?: (workflowId: number, stepId: number, body: { stepName?: string; conditionExpression?: string; approverRoleId?: number | null; approvalLevels?: ApprovalLevelInput[] }) => Promise<boolean>;
  onSaveApprovalLevels?: (stepId: number, levels: ApprovalLevelInput[]) => Promise<ApprovalLevel[]>;
  onReorderStep?: (workflowId: number, stepId: number, newOrder: number) => Promise<boolean>;
  onUpdateTransitions?: (workflowId: number, stepId: number, body: { transitions: { branch: "yes" | "no"; targetStepId: number }[] }) => Promise<boolean>;
  onSave?: () => Promise<boolean>;
  /** Optional: full-fidelity save once the backend patch (nodeKind/config/position) is applied. */
  onSaveGraph?: (graph: { nodes: WFNode[]; edges: WFEdge[] }) => Promise<boolean>;
}

let idCounter = 0;
function nextId(prefix = "n") {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

function defaultNodeData(kind: NodeKind): WorkflowNodeData {
  const def = NODE_LIBRARY_BY_KIND[kind];
  const config: Record<string, unknown> = {};
  def.configFields.forEach((f) => {
    if (f.defaultValue !== undefined) config[f.key] = f.defaultValue;
  });
  return { kind, name: def.label, description: "", config, status: "idle", isNew: true, approvalLevels: kind === "approval" ? [] : undefined };
}

function makeNode(kind: NodeKind, position: { x: number; y: number }): WFNode {
  return {
    id: nextId(kind),
    type: "workflowNode",
    position,
    data: defaultNodeData(kind),
  };
}

function edgeLabelFor(kind: NodeKind, sourceHandle: string | null | undefined): { label?: string; branch?: string } {
  const def = NODE_LIBRARY_BY_KIND[kind];
  const out = def?.outputs.find((o) => o.id === sourceHandle);
  if (out?.label) return { label: out.label, branch: out.id };
  if (sourceHandle?.startsWith("case:")) return { label: sourceHandle.slice(5), branch: sourceHandle };
  return {};
}

// ---------------------------------------------------------------------------
// Conversion: backend steps/transitions <-> React Flow graph
// ---------------------------------------------------------------------------

function stepKindFromBackend(step: WorkflowStep): NodeKind {
  // Anything the ITSM backend already understands maps 1:1; steps created by
  // this editor for the richer node types stash their real kind in
  // stepData.nodeKind (see backend patch) when available.
  if (step.nodeKind && NODE_LIBRARY_BY_KIND[step.nodeKind]) return step.nodeKind;
  return (step.stepType as NodeKind) ?? "task";
}

function stepsToGraph(steps: WorkflowStep[] = [], transitions: WorkflowTransition[] = []): { nodes: WFNode[]; edges: WFEdge[] } {
  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const nodes: WFNode[] = [];
  const edges: WFEdge[] = [];

  const startId = "start";
  nodes.push({
    id: startId,
    type: "workflowNode",
    position: { x: 0, y: 0 },
    data: { kind: "start", name: "Start", config: {}, status: "idle" },
  });

  sorted.forEach((step, i) => {
    const kind = stepKindFromBackend(step);
    const id = String(step.workflowStepId);
    nodes.push({
      id,
      type: "workflowNode",
      position: step.positionX != null && step.positionY != null ? { x: step.positionX, y: step.positionY } : { x: 0, y: (i + 1) * 120 },
      data: {
        kind,
        name: step.stepName,
        description: step.conditionExpression ?? undefined,
        config: { ...(step.config ?? {}), approverRoleId: step.approverRole?.roleId ?? step.config?.approverRoleId },
        approvalLevels: step.approvalLevels ?? [],
        status: "idle",
        stepId: step.workflowStepId,
      },
    });

    const stepTransitions = transitions.filter((t) => t.fromStep.workflowStepId === step.workflowStepId);
    if (stepTransitions.length) {
      stepTransitions.forEach((t) => {
        const targetId = t.toStep ? String(t.toStep.workflowStepId) : "end";
        const branch = t.branch === "yes" ? "true" : t.branch === "no" ? "false" : t.branch;
        edges.push({
          id: nextId("e"),
          source: id,
          target: targetId,
          sourceHandle: branch === "true" || branch === "false" ? branch : "out",
          type: "workflowEdge",
          markerEnd: { type: MarkerType.ArrowClosed, color: branch === "true" ? "#16a34a" : branch === "false" ? "#dc2626" : "#94a3b8" },
          data: { branch, label: kind === "condition" ? branch : undefined },
        });
      });
    } else {
      const nextStep = sorted[i + 1];
      const targetId = nextStep ? String(nextStep.workflowStepId) : "end";
      edges.push({
        id: nextId("e"),
        source: i === 0 ? startId : String(sorted[i - 1].workflowStepId) === id ? startId : id,
        target: targetId,
        sourceHandle: "out",
        type: "workflowEdge",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
        data: {},
      });
    }

    if (i === 0) {
      edges.push({
        id: nextId("e"),
        source: startId,
        target: id,
        sourceHandle: "out",
        type: "workflowEdge",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
        data: {},
      });
    }
  });

  if (sorted.length > 0) {
    nodes.push({
      id: "end",
      type: "workflowNode",
      position: { x: 0, y: (sorted.length + 1) * 120 },
      data: { kind: "end", name: "End", config: {}, status: "idle" },
    });
  }

  // De-dupe accidental duplicate edges from the fallback linear-chain logic above.
  const seen = new Set<string>();
  const dedupedEdges = edges.filter((e) => {
    const key = `${e.source}->${e.sourceHandle}->${e.target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { nodes, edges: dedupedEdges };
}

// ---------------------------------------------------------------------------
// Palette (left sidebar)
// ---------------------------------------------------------------------------

function Palette({ onDragStartNode }: { onDragStartNode: (kind: NodeKind) => void }) {
  const items = (["approval", "task", "notification", "condition"] as NodeKind[]).map((kind) => NODE_LIBRARY_BY_KIND[kind]);
  const icons = { approval: CheckCircle2, task: ListChecks, notification: Bell, condition: GitBranch };

  return (
    <aside className="w-[280px] shrink-0 border-r border-slate-200 bg-white flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-600">Workflow</div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = icons[item.kind as keyof typeof icons];
          return (
            <div
              key={item.kind}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/workflow-node-kind", item.kind);
                e.dataTransfer.effectAllowed = "move";
                onDragStartNode(item.kind);
              }}
              className="flex cursor-grab items-center gap-2 border-b border-slate-200 px-3 py-2.5 text-left text-[12px] text-slate-700 hover:bg-slate-100 active:cursor-grabbing"
              title={item.description}
            >
              <Icon className="size-3.5 shrink-0 text-slate-600" />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Properties panel (right sidebar)
// ---------------------------------------------------------------------------

function PropertiesPanel({
  node, allNodes, onChangeName, onChangeDescription, onChangeConfig, onDelete, onAddCase, onRemoveCase, onOpenApproval,
}: {
  node: WFNode | null;
  allNodes: WFNode[];
  onChangeName: (v: string) => void;
  onChangeDescription: (v: string) => void;
  onChangeConfig: (key: string, v: string | number | boolean) => void;
  onDelete: () => void;
  onAddCase: (label: string) => void;
  onRemoveCase: (label: string) => void;
  onOpenApproval: () => void;
}) {
  const [caseInput, setCaseInput] = useState("");
  if (!node) {
    return null;
  }
  const def = NODE_LIBRARY_BY_KIND[node.data.kind];
  const usageCount = allNodes.length;

  return (
    <div className="w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-400">{def?.category}</div>
          <div className="text-sm font-semibold text-slate-800">{def?.label ?? node.data.kind}</div>
        </div>
        {!def?.terminal && (
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500" title="Delete node">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Name</label>
          <input
            value={node.data.name}
            onChange={(e) => onChangeName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Description</label>
          <textarea
            value={node.data.description ?? ""}
            onChange={(e) => onChangeDescription(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-16 resize-none"
            placeholder="Add a description..."
          />
        </div>

        {node.data.kind === "approval" ? (
          <div className="space-y-3 rounded-[7px] border border-slate-200 bg-slate-50 p-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Approval levels</p>
              <p className="mt-1 text-xs text-slate-500">{node.data.approvalLevels?.length ?? 0} level{node.data.approvalLevels?.length === 1 ? "" : "s"} configured</p>
            </div>
            <button type="button" onClick={onOpenApproval} className="w-full rounded-[7px] bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
              Configure approval
            </button>
          </div>
        ) : def?.configFields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">{f.label}</label>
            {f.type === "textarea" || f.type === "code" ? (
              <textarea
                value={String(node.data.config[f.key] ?? "")}
                onChange={(e) => onChangeConfig(f.key, e.target.value)}
                placeholder={f.placeholder}
                className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-24 resize-none ${f.type === "code" ? "font-mono text-xs" : ""}`}
              />
            ) : f.type === "select" ? (
              <select
                value={String(node.data.config[f.key] ?? f.defaultValue ?? "")}
                onChange={(e) => onChangeConfig(f.key, e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === "checkbox" ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(node.data.config[f.key])}
                  onChange={(e) => onChangeConfig(f.key, e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-slate-600">Enabled</span>
              </label>
            ) : (
              <input
                type={f.type === "number" ? "number" : "text"}
                value={String(node.data.config[f.key] ?? "")}
                onChange={(e) => onChangeConfig(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            )}
          </div>
        ))}

        {def?.dynamicOutputs && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-xs font-medium text-slate-500">Case outputs</label>
            <div className="flex flex-wrap gap-1.5">
              {(node.data.caseOutputs ?? []).map((c) => (
                <span key={c} className="flex items-center gap-1 text-[11px] bg-orange-50 text-orange-700 border border-orange-200 rounded-full pl-2 pr-1 py-0.5">
                  {c}
                  <button onClick={() => onRemoveCase(c)} className="hover:text-orange-900"><X className="size-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={caseInput}
                onChange={(e) => setCaseInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && caseInput.trim()) { onAddCase(caseInput.trim()); setCaseInput(""); } }}
                placeholder="Case value..."
                className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
              />
              <button
                onClick={() => { if (caseInput.trim()) { onAddCase(caseInput.trim()); setCaseInput(""); } }}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 rounded-lg hover:bg-slate-200"
              >Add</button>
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-start gap-2 bg-amber-50 rounded-lg p-3">
          <Info className="size-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">{usageCount} node{usageCount === 1 ? "" : "s"} total in this workflow.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface ValidationIssue { nodeId: string; message: string; severity: "error" | "warning"; }

function validateGraph(nodes: WFNode[], edges: WFEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  edges.forEach((e) => {
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
    outgoing.set(e.source, (outgoing.get(e.source) ?? 0) + 1);
  });

  nodes.forEach((n) => {
    const def = NODE_LIBRARY_BY_KIND[n.data.kind];
    if (!def) return;
    if (def.inputs !== "none" && !incoming.get(n.id)) {
      issues.push({ nodeId: n.id, message: `"${n.data.name}" has no incoming connection`, severity: "warning" });
    }
    if (def.kind !== "end" && def.outputs.length > 0 && !outgoing.get(n.id)) {
      issues.push({ nodeId: n.id, message: `"${n.data.name}" has no outgoing connection`, severity: "warning" });
    }
    def.configFields.forEach((f) => {
      const required = ["url", "path", "expression", "script", "command", "query"].includes(f.key);
      if (required && !n.data.config[f.key]) {
        issues.push({ nodeId: n.id, message: `"${n.data.name}" is missing "${f.label}"`, severity: "error" });
      }
    });
  });

  return issues;
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function Toolbar({
  onAutoLayout, onFit, onZoomIn, onZoomOut, onUndo, onRedo, canUndo, canRedo,
  onSave, saving, onExecute, executing, issueCount, onToggleValidation, showValidation,
  onGroup, onUngroup, canGroup, canUngroup,
}: {
  onAutoLayout: (mode: LayoutMode) => void;
  onFit: () => void; onZoomIn: () => void; onZoomOut: () => void;
  onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean;
  onSave: () => void; saving: boolean;
  onExecute: () => void; executing: boolean;
  issueCount: number; onToggleValidation: () => void; showValidation: boolean;
  onGroup: () => void; onUngroup: () => void; canGroup: boolean; canUngroup: boolean;
}) {
  const [layoutOpen, setLayoutOpen] = useState(false);
  return (
    <div className="flex items-center gap-1.5 border-b border-slate-200 bg-white px-3 py-2">
      <button onClick={onUndo} disabled={!canUndo} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30" title="Undo (Ctrl+Z)"><RotateCcw className="size-4" /></button>
      <button onClick={onRedo} disabled={!canRedo} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30" title="Redo (Ctrl+Shift+Z)"><RotateCw className="size-4" /></button>
      <div className="mx-1 h-5 w-px bg-slate-200" />
      <button onClick={onZoomOut} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" title="Zoom out"><ZoomOut className="size-4" /></button>
      <button onClick={onZoomIn} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" title="Zoom in"><ZoomIn className="size-4" /></button>
      <button onClick={onFit} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" title="Fit view"><Maximize2 className="size-4" /></button>
      <div className="mx-1 h-5 w-px bg-slate-200" />
      <div className="relative">
        <button onClick={() => setLayoutOpen((v) => !v)} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
          <LayoutGrid className="size-4" /> Auto Layout <ChevronDown className="size-3" />
        </button>
        {layoutOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {(["horizontal", "vertical", "compact", "hierarchical"] as LayoutMode[]).map((m) => (
              <button key={m} onClick={() => { onAutoLayout(m); setLayoutOpen(false); }} className="w-full px-3 py-1.5 text-left text-xs capitalize hover:bg-slate-50">{m}</button>
            ))}
          </div>
        )}
      </div>
      <div className="mx-1 h-5 w-px bg-slate-200" />
      <button onClick={onGroup} disabled={!canGroup} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30" title="Group selected nodes"><GroupIcon className="size-4" /></button>
      <button onClick={onUngroup} disabled={!canUngroup} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30" title="Ungroup"><Ungroup className="size-4" /></button>
      <div className="flex-1" />
      <button onClick={onToggleValidation} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${issueCount > 0 ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "text-slate-500 hover:bg-slate-100"} ${showValidation ? "ring-1 ring-amber-300" : ""}`}>
        <AlertTriangle className="size-3.5" /> {issueCount > 0 ? `${issueCount} issue${issueCount === 1 ? "" : "s"}` : "Valid"}
      </button>
      <button onClick={onExecute} disabled={executing} className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50">
        <Play className="size-3.5" /> {executing ? "Running..." : "Run"}
      </button>
      <button onClick={onSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
        <Save className="size-3.5" /> {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick node picker (used by right-click "Add node" and the edge "+" button)
// ---------------------------------------------------------------------------

function NodePicker({ x, y, onPick, onClose }: { x: number; y: number; onPick: (kind: NodeKind) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const items = NODE_LIBRARY.filter((n) => !n.terminal && n.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="fixed inset-0 z-30" onClick={onClose}>
      <div
        className="absolute w-64 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl py-1"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes..."
            className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
          />
        </div>
        {items.map((item) => (
          <button
            key={item.kind}
            onClick={() => onPick(item.kind)}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-2"
          >
            <span className="text-slate-700 font-medium">{item.label}</span>
            <span className="text-slate-400 truncate">{item.description}</span>
          </button>
        ))}
        {items.length === 0 && <div className="px-3 py-3 text-xs text-slate-400">No matches</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

interface Snapshot { nodes: WFNode[]; edges: WFEdge[]; }

function WorkflowEditorInner(props: WorkflowEditorProps) {
  const { workflowId, steps, transitions = [], roles = [], assignmentGroups = [], onAddStep, onUpdateStep, onRemoveStep, onUpdateTransitions, onSaveApprovalLevels, onSave, onSaveGraph } = props;
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();

  const initial = useMemo(() => stepsToGraph(steps, transitions), [workflowId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, setNodes, onNodesChange] = useNodesState<WFNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WFEdge>(initial.edges);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [approvalDialogNodeId, setApprovalDialogNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; flowX?: number; flowY?: number; edgeId?: string } | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);

  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const [, forceRerender] = useState(0);
  const clipboard = useRef<WFNode[]>([]);

  const pushHistory = useCallback(() => {
    past.current.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) });
    if (past.current.length > 50) past.current.shift();
    future.current = [];
    forceRerender((v) => v + 1);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) });
    setNodes(prev.nodes);
    setEdges(prev.edges);
    forceRerender((v) => v + 1);
  }, [nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) });
    setNodes(next.nodes);
    setEdges(next.edges);
    forceRerender((v) => v + 1);
  }, [nodes, edges, setNodes, setEdges]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const approvalDialogNode = nodes.find((n) => n.id === approvalDialogNodeId && n.data.kind === "approval") ?? null;

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    if (connection.source === connection.target) return;
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const meta = sourceNode ? edgeLabelFor(sourceNode.data.kind, connection.sourceHandle) : {};
    setEdges((eds) => addEdge({
      ...connection,
      type: "workflowEdge",
      markerEnd: { type: MarkerType.ArrowClosed, color: meta.branch === "true" ? "#16a34a" : meta.branch === "false" ? "#dc2626" : "#94a3b8" },
      data: meta,
    }, eds));
    pushHistory();
  }, [nodes, setEdges, pushHistory]);

  const addNodeAt = useCallback((kind: NodeKind, position: { x: number; y: number }) => {
    const node = makeNode(kind, position);
    setNodes((nds) => nds.concat(node));
    setSelectedNodeId(node.id);
    pushHistory();
    return node;
  }, [setNodes, pushHistory]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData("application/workflow-node-kind") as NodeKind;
    if (!kind) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addNodeAt(kind, position);
  }, [screenToFlowPosition, addNodeAt]);

  // Right-click "insert node" on an edge: split it into source -> new -> target.
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as { edgeId: string };
      const edge = edges.find((ed) => ed.id === detail.edgeId);
      if (!edge) return;
      const rect = document.querySelector(".workflow-canvas")?.getBoundingClientRect();
      setContextMenu({ x: (rect?.left ?? 0) + 200, y: (rect?.top ?? 0) + 200, edgeId: detail.edgeId });
    }
    window.addEventListener("workflow:insert-node-on-edge", handler);
    return () => window.removeEventListener("workflow:insert-node-on-edge", handler);
  }, [edges]);

  const insertNodeOnEdge = useCallback((edgeId: string, kind: NodeKind) => {
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return;
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    const mid = sourceNode && targetNode
      ? { x: (sourceNode.position.x + targetNode.position.x) / 2, y: (sourceNode.position.y + targetNode.position.y) / 2 }
      : { x: 0, y: 0 };
    const node = makeNode(kind, mid);
    setNodes((nds) => nds.concat(node));
    setEdges((eds) => eds.filter((e) => e.id !== edgeId).concat([
      { ...edge, id: nextId("e"), target: node.id, targetHandle: "in", data: edge.data },
      { id: nextId("e"), source: node.id, sourceHandle: "out", target: edge.target, targetHandle: edge.targetHandle, type: "workflowEdge", markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" }, data: {} },
    ]));
    pushHistory();
  }, [edges, nodes, setNodes, setEdges, pushHistory]);

  const updateSelectedData = useCallback((patch: Partial<WorkflowNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.map((n) => n.id === selectedNodeId ? { ...n, data: { ...n.data, ...patch } } : n));
  }, [selectedNodeId, setNodes]);

  const deleteSelected = useCallback(() => {
    const toDelete = nodes.filter((n) => n.selected || n.id === selectedNodeId).filter((n) => n.data.kind !== "start" && n.data.kind !== "end");
    if (toDelete.length === 0) return;
    const idsToDelete = new Set(toDelete.map((n) => n.id));
    // Best-effort: remove already-persisted steps from the backend immediately.
    toDelete.forEach((n) => { if (n.data.stepId) onRemoveStep?.(workflowId, n.data.stepId); });
    setNodes((nds) => nds.filter((n) => !idsToDelete.has(n.id) && (n.parentId ? !idsToDelete.has(n.parentId) : true)));
    setEdges((eds) => eds.filter((e) => !idsToDelete.has(e.source) && !idsToDelete.has(e.target)));
    setSelectedNodeId(null);
    pushHistory();
  }, [nodes, selectedNodeId, workflowId, onRemoveStep, setNodes, setEdges, pushHistory]);

  const duplicateSelected = useCallback(() => {
    const sel = nodes.filter((n) => n.selected || n.id === selectedNodeId);
    if (!sel.length) return;
    const copies = sel.map((n) => ({ ...n, id: nextId(n.data.kind), selected: true, position: { x: n.position.x + 40, y: n.position.y + 40 }, data: { ...n.data, isNew: true, stepId: undefined } }));
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })).concat(copies));
    pushHistory();
  }, [nodes, selectedNodeId, setNodes, pushHistory]);

  const copySelected = useCallback(() => {
    clipboard.current = nodes.filter((n) => n.selected);
  }, [nodes]);

  const pasteClipboard = useCallback(() => {
    if (!clipboard.current.length) return;
    const copies = clipboard.current.map((n) => ({ ...n, id: nextId(n.data.kind), selected: true, position: { x: n.position.x + 60, y: n.position.y + 60 }, data: { ...n.data, isNew: true, stepId: undefined } }));
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })).concat(copies));
    pushHistory();
  }, [setNodes, pushHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      else if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
      else if (mod && e.key.toLowerCase() === "c") { e.preventDefault(); copySelected(); }
      else if (mod && e.key.toLowerCase() === "v") { e.preventDefault(); pasteClipboard(); }
      else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSelected(); }
      else if (e.key === "Delete" || e.key === "Backspace") { deleteSelected(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, copySelected, pasteClipboard, duplicateSelected, deleteSelected]);

  const runAutoLayout = useCallback((mode: LayoutMode) => {
    setNodes((nds) => autoLayout(nds, edges, mode) as WFNode[]);
    pushHistory();
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
  }, [edges, setNodes, pushHistory, fitView]);

  // ---- Group / ungroup (lightweight subflow grouping) ----
  const canGroup = nodes.filter((n) => n.selected && n.data.kind !== "start" && n.data.kind !== "end").length >= 2;
  const canUngroup = nodes.some((n) => n.selected && n.type === "group");

  const groupSelected = useCallback(() => {
    const sel = nodes.filter((n) => n.selected && n.data.kind !== "start" && n.data.kind !== "end");
    if (sel.length < 2) return;
    const minX = Math.min(...sel.map((n) => n.position.x)) - 40;
    const minY = Math.min(...sel.map((n) => n.position.y)) - 60;
    const maxX = Math.max(...sel.map((n) => n.position.x + 210)) + 40;
    const maxY = Math.max(...sel.map((n) => n.position.y + 70)) + 40;
    const groupId = nextId("group");
    const groupNode: WFNode = {
      id: groupId,
      type: "group",
      position: { x: minX, y: minY },
      style: { width: maxX - minX, height: maxY - minY, background: "rgba(148,163,184,0.06)", border: "1.5px dashed #cbd5e1", borderRadius: 12 },
      data: { kind: "custom", name: "Group", config: {}, status: "idle" } as WorkflowNodeData,
      selectable: true,
    };
    const selIds = new Set(sel.map((n) => n.id));
    setNodes((nds) => [
      groupNode,
      ...nds.map((n) => selIds.has(n.id)
        ? { ...n, parentId: groupId, extent: "parent" as const, position: { x: n.position.x - minX, y: n.position.y - minY }, selected: false }
        : n),
    ]);
    pushHistory();
  }, [nodes, setNodes, pushHistory]);

  const ungroupSelected = useCallback(() => {
    const groups = nodes.filter((n) => n.selected && n.type === "group");
    if (!groups.length) return;
    const groupIds = new Set(groups.map((g) => g.id));
    setNodes((nds) => nds
      .filter((n) => !groupIds.has(n.id))
      .map((n) => {
        if (n.parentId && groupIds.has(n.parentId)) {
          const g = groups.find((gg) => gg.id === n.parentId)!;
          return { ...n, parentId: undefined, extent: undefined, position: { x: n.position.x + g.position.x, y: n.position.y + g.position.y } };
        }
        return n;
      }));
    pushHistory();
  }, [nodes, setNodes, pushHistory]);

  // ---- Execution simulation ----
  const runExecution = useCallback(async () => {
    setExecuting(true);
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: "idle", errorMessage: undefined, durationMs: undefined } })));
    setEdges((eds) => eds.map((e) => ({ ...e, data: { ...e.data, animated: false, status: undefined } })));

    const incoming = new Map<string, string[]>();
    edges.forEach((e) => incoming.set(e.target, [...(incoming.get(e.target) ?? []), e.source]));
    const startNodes = nodes.filter((n) => !incoming.get(n.id)?.length);
    const visited = new Set<string>();
    let frontier = startNodes.map((n) => n.id);

    const setStatus = (id: string, status: ExecutionStatus, durationMs?: number) =>
      setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, status, durationMs } } : n));
    const setEdgeAnim = (id: string, on: boolean, status?: ExecutionStatus) =>
      setEdges((eds) => eds.map((e) => e.id === id ? { ...e, data: { ...e.data, animated: on, status } } : e));

    while (frontier.length) {
      const current = frontier.filter((id) => !visited.has(id));
      current.forEach((id) => visited.add(id));
      current.forEach((id) => setStatus(id, "running"));
      await new Promise((r) => setTimeout(r, 450));
      current.forEach((id) => setStatus(id, "success", 300 + Math.round(Math.random() * 900)));

      const nextFrontier: string[] = [];
      current.forEach((id) => {
        const outEdges = edges.filter((e) => e.source === id);
        outEdges.forEach((e) => {
          setEdgeAnim(e.id, true, "success");
          nextFrontier.push(e.target);
        });
      });
      await new Promise((r) => setTimeout(r, 250));
      frontier = nextFrontier;
    }
    setExecuting(false);
  }, [nodes, edges, setNodes, setEdges]);

  // ---- Save ----
  const legacySave = useCallback(async () => {
    if (!onAddStep && !onUpdateStep) { await onSave?.(); return; }
    const ordered = nodes
      .filter((n) => n.data.kind !== "start" && n.data.kind !== "end" && n.type !== "group")
      .map((n) => ({ ...n, data: { ...n.data } }))
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

    for (let i = 0; i < ordered.length; i++) {
      const n = ordered[i];
      const def = NODE_LIBRARY_BY_KIND[n.data.kind];
      const backendType = def?.backendStepType ?? "task";
      if (n.data.isNew && !n.data.stepId) {
        const createdStep = await onAddStep?.(workflowId, {
          stepName: n.data.name,
          stepOrder: i + 1,
          stepType: backendType,
          approverRoleId: backendType === "approval" ? Number(n.data.config.approverRoleId) || undefined : undefined,
          approvalLevels: n.data.kind === "approval" ? (n.data.approvalLevels ?? []) : undefined,
        });
        if (createdStep) {
          n.data.stepId = createdStep.workflowStepId;
          n.data.isNew = false;
        }
      } else if (n.data.stepId) {
        await onUpdateStep?.(workflowId, n.data.stepId, {
          stepName: n.data.name,
          conditionExpression: backendType === "condition" ? String(n.data.config.expression ?? n.data.description ?? "") : undefined,
          approverRoleId: backendType === "approval" ? Number(n.data.config.approverRoleId) || null : undefined,
          approvalLevels: n.data.kind === "approval" ? (n.data.approvalLevels ?? []) : undefined,
        });
      }
    }

    const savedNodes = new Map(ordered.filter((node) => node.data.stepId).map((node) => [node.id, node.data.stepId!]));
    setNodes((current) => current.map((node) => {
      const stepId = savedNodes.get(node.id);
      return stepId ? { ...node, data: { ...node.data, stepId, isNew: false } } : node;
    }));

    // Best-effort: condition nodes' true/false edges -> legacy yes/no transitions.
    for (const n of ordered) {
      if (n.data.kind !== "condition" || !n.data.stepId) continue;
      const trueEdge = edges.find((e) => e.source === n.id && e.sourceHandle === "true");
      const falseEdge = edges.find((e) => e.source === n.id && e.sourceHandle === "false");
      const targets: { branch: "yes" | "no"; targetStepId: number }[] = [];
      const trueTarget = nodes.find((t) => t.id === trueEdge?.target);
      const falseTarget = nodes.find((t) => t.id === falseEdge?.target);
      if (trueTarget?.data.stepId) targets.push({ branch: "yes", targetStepId: trueTarget.data.stepId });
      if (falseTarget?.data.stepId) targets.push({ branch: "no", targetStepId: falseTarget.data.stepId });
      if (targets.length) await onUpdateTransitions?.(workflowId, n.data.stepId, { transitions: targets });
    }

    await onSave?.();
  }, [nodes, edges, workflowId, onAddStep, onUpdateStep, onUpdateTransitions, onSave, setNodes]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (onSaveGraph) {
        await onSaveGraph({ nodes, edges });
      } else {
        await legacySave();
      }
    } finally {
      setSaving(false);
    }
  }, [onSaveGraph, nodes, edges, legacySave]);

  const issues = useMemo(() => validateGraph(nodes, edges), [nodes, edges]);

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => setSelectedNodeId(node.id), []);
  const onPaneClick = useCallback(() => { setSelectedNodeId(null); setContextMenu(null); }, []);
  const onNodeDragStop = useCallback(() => pushHistory(), [pushHistory]);
  const onPaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    const me = e as React.MouseEvent;
    const flow = screenToFlowPosition({ x: me.clientX, y: me.clientY });
    setContextMenu({ x: me.clientX, y: me.clientY, flowX: flow.x, flowY: flow.y });
  }, [screenToFlowPosition]);

  return (
    <div className="flex h-full min-h-[640px] flex-col overflow-hidden bg-[#f3f5f8] text-[#1d2433]">
      <style>{`
        @keyframes workflow-edge-flow { to { stroke-dashoffset: -20; } }
        .react-flow__attribution { display: none; }
        .react-flow__panel {
          border-radius: 10px;
        }
      `}</style>

      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="font-extrabold uppercase tracking-[0.14em] text-brand-600">Workflow</span>
          <span className="text-slate-300">/</span>
          <span className="font-medium text-slate-600">Workflows</span>
          <span className="text-slate-300">/</span>
          <span className="font-medium text-slate-500">Activity</span>
        </div>
        <button className="rounded-md bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-brand-700">
          Submit
        </button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden border-t border-slate-200">
        <Palette onDragStartNode={() => {}} />

        <div className="flex min-w-0 flex-1 flex-col bg-[#f5f6f8]">
          <Toolbar
            onAutoLayout={runAutoLayout}
            onFit={() => fitView({ padding: 0.2, duration: 300 })}
            onZoomIn={() => zoomIn({ duration: 200 })}
            onZoomOut={() => zoomOut({ duration: 200 })}
            onUndo={undo} onRedo={redo}
            canUndo={past.current.length > 0} canRedo={future.current.length > 0}
            onSave={handleSave} saving={saving}
            onExecute={runExecution} executing={executing}
            issueCount={issues.length} onToggleValidation={() => setShowValidation((v) => !v)} showValidation={showValidation}
            onGroup={groupSelected} onUngroup={ungroupSelected} canGroup={canGroup} canUngroup={canUngroup}
          />

          <div className="relative flex-1 overflow-hidden workflow-canvas" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onNodeDragStop={onNodeDragStop}
              onPaneContextMenu={onPaneContextMenu}
              nodeTypes={WORKFLOW_NODE_TYPES}
              edgeTypes={WORKFLOW_EDGE_TYPES}
              defaultEdgeOptions={{ type: "workflowEdge", markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" } }}
              selectionMode={SelectionMode.Partial}
              multiSelectionKeyCode="Shift"
              selectionKeyCode="Shift"
              panOnScroll
              zoomOnScroll={false}
              zoomOnPinch
              minZoom={0.1}
              maxZoom={2}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Lines} gap={18} size={1} color="#dfe7f2" />
              <Controls showInteractive={false} className="!rounded-lg !border !border-slate-200 !shadow-sm" />
              <MiniMap pannable zoomable nodeColor={() => "#cbd5e1"} maskColor="rgba(241,245,249,0.72)" className="!rounded-lg !border !border-slate-200 !shadow-sm" />
            </ReactFlow>

            {showValidation && (
              <div className="absolute right-3 top-3 z-10 w-72 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-600">Validation</span>
                  <button onClick={() => setShowValidation(false)}><X className="size-3.5 text-slate-400" /></button>
                </div>
                {issues.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-slate-400">No issues found</div>
                ) : issues.map((issue, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedNodeId(issue.nodeId)}
                    className="flex w-full items-start gap-2 border-b border-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-50"
                  >
                    <AlertTriangle className={`mt-0.5 size-3.5 shrink-0 ${issue.severity === "error" ? "text-rose-500" : "text-amber-500"}`} />
                    <span className="text-slate-600">{issue.message}</span>
                  </button>
                ))}
              </div>
            )}

            {contextMenu && contextMenu.flowX !== undefined && !contextMenu.edgeId && (
              <NodePicker
                x={contextMenu.x} y={contextMenu.y}
                onPick={(kind) => { addNodeAt(kind, { x: contextMenu.flowX!, y: contextMenu.flowY! }); setContextMenu(null); }}
                onClose={() => setContextMenu(null)}
              />
            )}
            {contextMenu?.edgeId && (
              <NodePicker
                x={contextMenu.x} y={contextMenu.y}
                onPick={(kind) => { insertNodeOnEdge(contextMenu.edgeId!, kind); setContextMenu(null); }}
                onClose={() => setContextMenu(null)}
              />
            )}
          </div>
        </div>

        <PropertiesPanel
          node={selectedNode}
          allNodes={nodes}
          onChangeName={(v) => updateSelectedData({ name: v })}
          onChangeDescription={(v) => updateSelectedData({ description: v })}
          onChangeConfig={(key, v) => updateSelectedData({ config: { ...(selectedNode?.data.config ?? {}), [key]: v } })}
          onDelete={deleteSelected}
          onAddCase={(label) => updateSelectedData({ caseOutputs: [...(selectedNode?.data.caseOutputs ?? []), label] })}
          onRemoveCase={(label) => updateSelectedData({ caseOutputs: (selectedNode?.data.caseOutputs ?? []).filter((c) => c !== label) })}
          onOpenApproval={() => selectedNode && setApprovalDialogNodeId(selectedNode.id)}
        />
        {approvalDialogNode && (
          <ApprovalPropertiesDialog
            open
            stepName={approvalDialogNode.data.name}
            approvalLevels={approvalDialogNode.data.approvalLevels ?? []}
            roles={roles}
            assignmentGroups={assignmentGroups}
            onClose={() => setApprovalDialogNodeId(null)}
            onSave={async (levels) => {
              const savedLevels = approvalDialogNode.data.stepId && onSaveApprovalLevels
                ? await onSaveApprovalLevels(approvalDialogNode.data.stepId, levels)
                : levels;
              const approverRoleId = savedLevels[0]?.approverType === "role" ? savedLevels[0].approverId : undefined;
              setNodes((current) => current.map((node) => node.id === approvalDialogNode.id
                ? { ...node, data: { ...node.data, approvalLevels: savedLevels, config: { ...node.data.config, approverRoleId: approverRoleId ?? "" } } }
                : node));
              return savedLevels;
            }}
          />
        )}
      </div>
    </div>
  );
}

export function WorkflowEditor(props: WorkflowEditorProps) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner {...props} />
    </ReactFlowProvider>
  );
}

export type { WorkflowEditorProps };
