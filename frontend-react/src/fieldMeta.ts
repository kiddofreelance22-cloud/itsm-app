import type { Priority, Status } from "./types";

export const PRIORITY_COLOR_HEX: Record<string, string> = {
  Red: "#D92D20",
  Amber: "#F79009",
  Blue: "#175CD3",
  Gray: "#98A2B3",
  Green: "#12B76A",
  Purple: "#7A5AF8",
};

export const PRIORITY_META: Record<Priority, { label: string; bg: string; color: string; dot: string }> = {
  CRITICAL: { label: "Critical", bg: "#FEF3F2", color: "#B42318", dot: "#D92D20" },
  HIGH: { label: "High", bg: "#FEF3F2", color: "#B42318", dot: "#D92D20" },
  MEDIUM: { label: "Medium", bg: "#FFFAEB", color: "#B54708", dot: "#F79009" },
  LOW: { label: "Low", bg: "#F2F4F7", color: "#344054", dot: "#98A2B3" },
};

export const STATUS_META: Record<Status, { label: string; bg: string; color: string; dot: string }> = {
  NEW: { label: "New", bg: "#F2F4F7", color: "#344054", dot: "#98A2B3" },
  ASSIGNED: { label: "Assigned", bg: "#EFF4FC", color: "#175CD3", dot: "#175CD3" },
  IN_PROGRESS: { label: "In Progress", bg: "#EFF4FC", color: "#175CD3", dot: "#175CD3" },
  PENDING: { label: "Pending", bg: "#F4F3FF", color: "#5925DC", dot: "#7A5AF8" },
  ON_HOLD: { label: "On Hold", bg: "#FFFAEB", color: "#B54708", dot: "#F79009" },
  RESOLVED: { label: "Resolved", bg: "#ECFDF3", color: "#067647", dot: "#12B76A" },
  CLOSED: { label: "Closed", bg: "#F2F4F7", color: "#667085", dot: "#98A2B3" },
};

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}
