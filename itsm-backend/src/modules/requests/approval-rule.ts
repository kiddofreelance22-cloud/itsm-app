import type { ApprovalRule } from "../workflows/entities/approval-level.entity";

export type ApprovalDecisionOutcome = "pending" | "approved" | "rejected";

export function evaluateApprovalRule(
  rule: ApprovalRule,
  approved: number,
  rejected: number,
  total: number,
): ApprovalDecisionOutcome {
  if (total <= 0) return "rejected";

  if (rule === "any") {
    if (approved > 0) return "approved";
    if (rejected > 0) return "rejected";
    return "pending";
  }

  const required = rule === "all" ? total : Math.floor(total / 2) + 1;
  if (approved >= required) return "approved";
  if (total - rejected < required) return "rejected";
  return "pending";
}
