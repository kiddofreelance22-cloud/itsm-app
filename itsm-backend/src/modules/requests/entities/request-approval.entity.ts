import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Unique } from "typeorm";
import { ServiceRequest } from "./request.entity";
import { User } from "../../users/entities/user.entity";

import type { ApprovalRule, ApproveOutcome, CommentPolicy, TimeoutOutcome, ParallelApprover, PlanAction, RejectOutcome } from "../../workflows/entities/approval-level.entity";

export type RequestApprovalStatus = "Pending" | "Approved" | "Rejected" | "Skipped" | "Escalated" | "Info requested";
export type RequestApproverType = "user" | "group" | "role" | "custom" | "requester_manager" | "parallel";

/** One row per approval level instantiated for a request. */
@Entity("request_approvals")
@Unique("uq_request_approval_level", ["request", "levelNumber"])
export class RequestApproval {
  @PrimaryGeneratedColumn({ name: "request_approval_id" }) requestApprovalId!: number;
  @ManyToOne(() => ServiceRequest, (r) => r.approvals, { onDelete: "CASCADE" }) @JoinColumn({ name: "request_id" }) request!: ServiceRequest;
  @Column({ name: "level_number" }) levelNumber!: number;
  @Column() title!: string;
  @Column({ name: "approver_type", type: "varchar" }) approverType!: RequestApproverType;
  @Column({ name: "approver_ref", type: "int", nullable: true }) approverRef?: number | null;
  @Column({ type: "varchar", default: "Pending" }) status!: RequestApprovalStatus;
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" }) @JoinColumn({ name: "acted_by" }) actedBy?: User | null;
  @Column({ name: "acted_at", type: "timestamp", nullable: true }) actedAt?: Date | null;
  @Column({ type: "text", nullable: true }) comments?: string | null;
  @Column({ name: "approval_rule", type: "varchar", length: 10, default: "any" }) approvalRule!: ApprovalRule;
  @Column({ name: "approvers", type: "jsonb", nullable: true }) approvers?: ParallelApprover[] | null;
  @Column({ name: "comment_policy", type: "varchar", length: 10, default: "reject" }) commentPolicy!: CommentPolicy;
  @Column({ name: "allow_reject", default: true }) allowReject!: boolean;
  @Column({ name: "allow_info", default: true }) allowInfo!: boolean;
  @Column({ name: "allow_delegate", default: false }) allowDelegate!: boolean;
  @Column({ name: "remind_days", type: "int", default: 0 }) remindDays!: number;
  @Column({ name: "timeout_days", type: "int", default: 0 }) timeoutDays!: number;
  @Column({ name: "on_timeout", type: "varchar", length: 10, default: "escalate" }) onTimeout!: TimeoutOutcome;
  @Column({ name: "timeout_arg", type: "varchar", length: 100, nullable: true }) timeoutArg?: string | null;
  @Column({ name: "pending_since", type: "timestamp", nullable: true }) pendingSince?: Date | null;
  @Column({ name: "reminded_at", type: "timestamp", nullable: true }) remindedAt?: Date | null;
  @Column({ name: "on_approve", type: "varchar", length: 20, default: "next" }) onApprove!: ApproveOutcome;
  @Column({ name: "approve_arg", type: "varchar", length: 500, nullable: true }) approveArg?: string | null;
  /** E-mail / update-request steps that follow this level; run once it is approved. */
  @Column({ name: "after_actions", type: "jsonb", nullable: true }) afterActions?: PlanAction[] | null;
  @Column({ name: "on_reject", type: "varchar", length: 20, default: "close" }) onReject!: RejectOutcome;
  @Column({ name: "reject_arg", type: "varchar", length: 100, nullable: true }) rejectArg?: string | null;
  /** The lifecycle approval level this row was created from (used to find the target of "send back"). */
  @Column({ name: "source_level_id", type: "int", nullable: true }) sourceLevelId?: number | null;
  /** True for a level inserted by an escalation. Rejecting an appeal always closes the request. */
  @Column({ name: "is_appeal", default: false }) isAppeal!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
