"use client";

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import type { WorkflowEdgeData } from "./types";

const STATUS_COLOR: Record<string, string> = {
  running: "#2563eb",
  success: "#16a34a",
  failed: "#dc2626",
  idle: "",
};

export function WorkflowCustomEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  markerEnd, selected, data, style,
}: EdgeProps) {
  const d = (data ?? {}) as WorkflowEdgeData;
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
    borderRadius: 10,
  });

  const branchColor =
    d.branch === "true" || d.branch === "success" ? "#16a34a" :
    d.branch === "false" || d.branch === "error" ? "#dc2626" :
    undefined;

  const strokeColor = (d.status && STATUS_COLOR[d.status]) || branchColor || "#94a3b8";
  const strokeWidth = selected ? 2.5 : 1.75;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: d.animated || d.status === "running" ? "6 4" : undefined,
          animation: d.animated || d.status === "running" ? "workflow-edge-flow 0.6s linear infinite" : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan group/edge flex items-center gap-1"
        >
          {d.label && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold shadow-sm border"
              style={{ color: strokeColor, borderColor: strokeColor, background: "white" }}
            >
              {d.label}
            </span>
          )}
          <button
            className="workflow-edge-add-btn flex items-center justify-center size-5 rounded-full bg-white border border-slate-300 text-slate-500 opacity-40 hover:opacity-100 hover:border-blue-400 hover:text-blue-500 shadow-sm transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              const evt = new CustomEvent("workflow:insert-node-on-edge", { detail: { edgeId: id } });
              window.dispatchEvent(evt);
            }}
            title="Insert node"
          >
            <Plus className="size-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const WORKFLOW_EDGE_TYPES = { workflowEdge: WorkflowCustomEdge };
