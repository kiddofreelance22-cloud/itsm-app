"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Play, Square, Zap, Webhook, Clock, Globe, Database, Mail, Bell, Code2, Terminal,
  Upload, Download, FileText, FilePlus, Wand2, Shuffle, Filter, GitMerge, Settings,
  GitBranch, SplitSquareHorizontal, Repeat, Hourglass, RotateCcw, Workflow, CheckCircle2,
  ListChecks, Puzzle, Loader2, XCircle, CheckCircle, MinusCircle,
} from "lucide-react";
import { NODE_LIBRARY_BY_KIND } from "./node-library";
import type { WorkflowNodeData } from "./types";

const ICONS: Record<string, React.ElementType> = {
  Play, Square, Zap, Webhook, Clock, Globe, Database, Mail, Bell, Code2, Terminal,
  Upload, Download, FileText, FilePlus, Wand2, Shuffle, Filter, GitMerge, Settings,
  GitBranch, SplitSquareHorizontal, Repeat, Hourglass, RotateCcw, Workflow, CheckCircle2,
  ListChecks, Puzzle,
};

const COLOR_MAP: Record<string, { ring: string; bg: string; icon: string }> = {
  emerald: { ring: "border-emerald-300", bg: "bg-emerald-50", icon: "text-emerald-600" },
  blue: { ring: "border-blue-300", bg: "bg-blue-50", icon: "text-blue-600" },
  amber: { ring: "border-amber-300", bg: "bg-amber-50", icon: "text-amber-600" },
  purple: { ring: "border-purple-300", bg: "bg-purple-50", icon: "text-purple-600" },
  orange: { ring: "border-orange-300", bg: "bg-orange-50", icon: "text-orange-600" },
  violet: { ring: "border-violet-300", bg: "bg-violet-50", icon: "text-violet-600" },
  rose: { ring: "border-rose-300", bg: "bg-rose-50", icon: "text-rose-600" },
  slate: { ring: "border-slate-300", bg: "bg-slate-50", icon: "text-slate-600" },
};

function StatusBadge({ status }: { status: WorkflowNodeData["status"] }) {
  switch (status) {
    case "running":
      return <Loader2 className="size-3.5 text-blue-500 animate-spin" />;
    case "success":
      return <CheckCircle className="size-3.5 text-emerald-500" />;
    case "failed":
      return <XCircle className="size-3.5 text-rose-500" />;
    case "waiting":
    case "pending":
      return <MinusCircle className="size-3.5 text-amber-400" />;
    case "skipped":
      return <MinusCircle className="size-3.5 text-slate-300" />;
    default:
      return null;
  }
}

function outputTop(index: number, count: number) {
  // Evenly distribute output handles down the right edge, leaving margin.
  if (count <= 1) return "50%";
  return `${16 + index * (68 / Math.max(1, count - 1))}%`;
}

export const WorkflowCustomNode = memo(function WorkflowCustomNode({ data, selected }: NodeProps) {
  const d = data as unknown as WorkflowNodeData;
  const def = NODE_LIBRARY_BY_KIND[d.kind];
  if (!def) return null;
  const Icon = ICONS[def.icon] ?? Puzzle;
  const colors = COLOR_MAP[def.color] ?? COLOR_MAP.slate;
  const extraOutputs: { id: string; label: string; color?: string }[] = d.caseOutputs?.length
    ? d.caseOutputs.map((c) => ({ id: `case:${c}`, label: c }))
    : [];
  const outputs = [...def.outputs, ...extraOutputs];
  const isError = d.status === "failed";

  return (
    <div
      className={[
        "group relative rounded-xl border-2 bg-white shadow-sm transition-all",
        "w-[210px]",
        selected ? "border-blue-500 shadow-md ring-2 ring-blue-100" : isError ? "border-rose-400" : colors.ring,
        d.status === "running" ? "ring-2 ring-blue-200" : "",
      ].join(" ")}
    >
      {def.inputs !== "none" && (
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          className="!w-3 !h-3 !bg-white !border-2 !border-slate-400"
        />
      )}

      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className={`flex items-center justify-center size-8 rounded-lg shrink-0 ${colors.bg}`}>
          <Icon className={`size-4 ${colors.icon}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-800 truncate">{d.name || def.label}</div>
          {d.description ? (
            <div className="text-[11px] text-slate-400 truncate">{d.description}</div>
          ) : (
            <div className="text-[11px] text-slate-300 truncate">{def.label}</div>
          )}
        </div>
        <StatusBadge status={d.status} />
      </div>

      {d.status === "failed" && d.errorMessage && (
        <div className="px-3 pb-2 -mt-1 text-[10px] text-rose-500 truncate" title={d.errorMessage}>
          {d.errorMessage}
        </div>
      )}
      {typeof d.durationMs === "number" && (d.status === "success" || d.status === "failed") && (
        <div className="px-3 pb-2 -mt-1 text-[10px] text-slate-400">{d.durationMs}ms</div>
      )}

      {outputs.map((out, i) => (
        <Handle
          key={out.id}
          type="source"
          position={Position.Right}
          id={out.id}
          style={{ top: outputTop(i, outputs.length) }}
          className="!w-3 !h-3 !border-2"
          data-color={out.color}
        >
          {out.label && (
            <span
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ color: out.color ?? "#475569", background: out.color ? `${out.color}1a` : "#f1f5f9" }}
            >
              {out.label}
            </span>
          )}
        </Handle>
      ))}

      {def.terminal && outputs.length === 0 && def.kind === "end" && null}
    </div>
  );
});

export const WORKFLOW_NODE_TYPES = { workflowNode: WorkflowCustomNode };
