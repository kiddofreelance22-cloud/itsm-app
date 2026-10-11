import dagre from "dagre";
import type { Edge, Node } from "@xyflow/react";

export type LayoutMode = "horizontal" | "vertical" | "compact" | "hierarchical";

const NODE_W = 220;
const NODE_H = 64;

/**
 * Runs Dagre over the current nodes/edges and returns new positions.
 * - horizontal: left -> right (triggers left, outputs right)
 * - vertical: top -> bottom
 * - compact: same as vertical but tighter spacing, for dense workflows
 * - hierarchical: horizontal with wider rank separation + centered branches
 */
export function autoLayout(nodes: Node[], edges: Edge[], mode: LayoutMode = "horizontal"): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));

  const rankdir = mode === "vertical" || mode === "compact" ? "TB" : "LR";
  const spacing =
    mode === "compact" ? { nodesep: 36, ranksep: 60 } :
    mode === "hierarchical" ? { nodesep: 70, ranksep: 140 } :
    { nodesep: 56, ranksep: 100 };

  g.setGraph({ rankdir, ...spacing, marginx: 40, marginy: 40 });

  // Group nodes are laid out by their children's bounding box, not by dagre directly.
  const layoutable = nodes.filter((n) => n.type !== "group");

  layoutable.forEach((node) => {
    const w = (node.width as number) || NODE_W;
    const h = (node.height as number) || NODE_H;
    g.setNode(node.id, { width: w, height: h });
  });

  edges.forEach((edge) => {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(g);

  return nodes.map((node) => {
    if (node.type === "group") return node;
    const pos = g.node(node.id);
    if (!pos) return node;
    return {
      ...node,
      position: { x: pos.x - (node.width || NODE_W) / 2, y: pos.y - (node.height || NODE_H) / 2 },
    };
  });
}
