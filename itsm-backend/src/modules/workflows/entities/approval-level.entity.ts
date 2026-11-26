import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { WorkflowStep } from "./workflow-step.entity";
import { AssignmentGroup } from "../../assignment-group/entities/assignment-group.entity";

/** "requester_manager" is resolved per request: the reporting manager on the requester's user profile. */
export type ApproveOutcome = "next" | "fulfil" | "step" | "notify" | "priority" | "assign" | "reroute" | "task" | "auto";
/** An e-mail or update-request step that runs when the level before it is approved. */
export type PlanAction =
  | { type: "email"; ruleId: number; to: string[] }
  | { type: "update"; field: "priority" | "assignmentGroup" | "agent"; value: number }
  | { type: "wait"; days: number }
  | { type: "record"; recordType: "incident" | "change" | "problem" | "work_order" | "request"; title: string; description?: string; priority?: string; priorityId?: number; catalogId?: number }
  | { type: "integration"; kind: "webhook" | "teams"; url: string; secret?: string; name: string };

export type RejectOutcome = "close" | "rework" | "back" | "escalate" | "continue";

export type CommentPolicy = "optional" | "reject" | "both";
export type TimeoutOutcome = "escalate" | "approve" | "reject";
export type ApprovalRule = "any" | "majority" | "all";
export interface ParallelApprover { type: "user" | "group" | "role" | "custom" | "requester_manager"; ref?: number | null; label?: string }

export type ApproverType = "user" | "group" | "role" | "custom" | "requester_manager" | "parallel";

@Entity("approval_levels")
export class ApprovalLevel {
  @PrimaryGeneratedColumn({ name: "approval_level_id" })
  approvalLevelId!: number;

  @ManyToOne(() => WorkflowStep, { onDelete: "CASCADE" })
  @JoinColumn({ name: "activity_id" })
  activity!: WorkflowStep;

  @Column({ name: "level_number" })
  levelNumber!: number;

  @Column({ name: "title" })
  title!: string;

  @Column({ name: "approver_type" })
  approverType!: ApproverType;

  @Column({ name: "approver_id", nullable: true })
  approverId?: number;

  @Column({ name: "auto_approval", default: false })
  autoApproval!: boolean;

  @Column({ name: "email_notifications_for_end_user", default: false })
  emailNotificationsForEndUser!: boolean;

  @Column({ name: "refer_back_to_requestor", default: false })
  referBackToRequestor!: boolean;

  @Column({ name: "refer_back_to_previous_approvers", default: false })
  referBackToPreviousApprovers!: boolean;

  /** any = one decision settles the level; majority / all collect a vote from each approver. */
  @Column({ name: "approval_rule", type: "varchar", length: 10, default: "any" })
  approvalRule!: ApprovalRule;

  /** approverType "parallel": everyone asked at the same time. */
  @Column({ name: "approvers", type: "jsonb", nullable: true })
  approvers?: ParallelApprover[] | null;

  @Column({ name: "comment_policy", type: "varchar", length: 10, default: "reject" }) commentPolicy!: CommentPolicy;
  @Column({ name: "allow_reject", default: true }) allowReject!: boolean;
  @Column({ name: "allow_info", default: true }) allowInfo!: boolean;
  @Column({ name: "allow_delegate", default: false }) allowDelegate!: boolean;
  @Column({ name: "remind_days", type: "int", default: 0 }) remindDays!: number;
  @Column({ name: "timeout_days", type: "int", default: 0 }) timeoutDays!: number;
  @Column({ name: "on_timeout", type: "varchar", length: 10, default: "escalate" }) onTimeout!: TimeoutOutcome;
  @Column({ name: "timeout_arg", type: "varchar", length: 100, nullable: true }) timeoutArg?: string | null;

  /** What happens when this level is approved. next = carry on. */
  @Column({ name: "on_approve", type: "varchar", length: 20, default: "next" })
  onApprove!: ApproveOutcome;

  /** step: later workflowStepId; notify: "<type>:<id>"; priority / assign / reroute: id; task: text. */
  @Column({ name: "approve_arg", type: "varchar", length: 500, nullable: true })
  approveArg?: string | null;

  /** What happens when this level is rejected. close = request closed as Rejected (default). */
  @Column({ name: "on_reject", type: "varchar", length: 20, default: "close" })
  onReject!: RejectOutcome;

  /** back: approval_level_id of an earlier level. escalate: "<approverType>:<id>". rework: "start" | "this". */
  @Column({ name: "reject_arg", type: "varchar", length: 100, nullable: true })
  rejectArg?: string | null;

  @ManyToOne(() => AssignmentGroup, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "custom_group_id" })
  customGroup?: AssignmentGroup;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
