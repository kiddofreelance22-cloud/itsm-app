import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { ChangeApproval } from "./change-approval.entity";
import { ChangeTask } from "./change-task.entity";
import { ChangeWorkNote } from "./change-work-note.entity";

/** Legacy coarse status, kept in sync with `state` so older screens keep working. */
export type ChangeStatus = "Open" | "In Progress" | "Completed" | "Cancelled";
/** The name of a change model (Standard, Normal and Emergency by default; more can be added in Change Models). */
export type ChangeType = string;
export type ChangeState = "New" | "Assess" | "Authorize" | "Scheduled" | "Implement" | "Review" | "Closed" | "Cancelled";
export type RiskLevel = "Low" | "Moderate" | "High" | "Very High";

@Entity("changes")
export class Change {
  @PrimaryGeneratedColumn({ name: "change_id" }) changeId!: number;
  @Column({ name: "change_code", unique: true, nullable: true }) changeCode!: string;
  @Column({ name: "short_description" }) shortDescription!: string;
  @Column({ type: "text", nullable: true }) description!: string;

  @Column({ default: "Open" }) status!: ChangeStatus;
  @Column({ name: "change_type", default: "Normal" }) changeType!: ChangeType;
  @Column({ default: "New" }) state!: ChangeState;

  @Column({ nullable: true }) category?: string;
  @Column({ name: "business_service", nullable: true }) businessService?: string;
  @Column({ name: "configuration_items", type: "jsonb", default: () => "'[]'" }) configurationItems!: string[];
  @Column({ name: "assignment_group", nullable: true }) assignmentGroup?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "assigned_to" }) assignedTo?: User;
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "requested_by" }) requestedBy?: User;

  @Column({ nullable: true }) impact?: string;
  @Column({ nullable: true }) urgency?: string;
  @Column({ nullable: true }) priority?: string;
  @Column({ type: "text", nullable: true }) justification?: string;

  @Column({ name: "risk_answers", type: "jsonb", default: () => "'{}'" }) riskAnswers!: Record<string, string>;
  @Column({ name: "risk_score", type: "int", nullable: true }) riskScore?: number;
  @Column({ name: "risk_level", nullable: true }) riskLevel?: RiskLevel;

  @Column({ name: "planned_start", type: "timestamp", nullable: true }) plannedStart?: Date;
  @Column({ name: "planned_end", type: "timestamp", nullable: true }) plannedEnd?: Date;
  @Column({ name: "actual_start", type: "timestamp", nullable: true }) actualStart?: Date;
  @Column({ name: "actual_end", type: "timestamp", nullable: true }) actualEnd?: Date;
  @Column({ name: "causes_outage", default: false }) causesOutage!: boolean;
  @Column({ name: "expected_outage", nullable: true }) expectedOutage?: string;

  @Column({ name: "implementation_plan", type: "text", nullable: true }) implementationPlan?: string;
  @Column({ name: "backout_plan", type: "text", nullable: true }) backoutPlan?: string;
  @Column({ name: "test_plan", type: "text", nullable: true }) testPlan?: string;
  @Column({ name: "communication_plan", type: "text", nullable: true }) communicationPlan?: string;

  @Column({ name: "implementation_outcome", nullable: true }) implementationOutcome?: string;
  @Column({ name: "implementation_notes", type: "text", nullable: true }) implementationNotes?: string;
  @Column({ type: "jsonb", nullable: true }) pir?: Record<string, string> | null;
  @Column({ name: "close_code", nullable: true }) closeCode?: string;
  @Column({ name: "close_notes", type: "text", nullable: true }) closeNotes?: string;
  @Column({ name: "related_records", type: "jsonb", default: () => "'[]'" }) relatedRecords!: { kind: string; number: string; title?: string }[];

  @Column({ name: "template_id", type: "varchar", nullable: true }) templateId?: string | null;
  @Column({ name: "cab_reviewed_at", type: "timestamp", nullable: true }) cabReviewedAt?: Date | null;
  @Column({ name: "lifecycle_steps", type: "jsonb", nullable: true, select: false }) lifecycleSteps?: unknown[] | null;
  @Column({ name: "lifecycle_step_index", type: "int", nullable: true, select: false }) lifecycleStepIndex?: number | null;
  @Column({ name: "lifecycle_wait_until", type: "timestamp", nullable: true, select: false }) lifecycleWaitUntil?: Date | null;
  @Column({ name: "completed_at", nullable: true, type: "timestamp" }) completedAt?: Date;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;

  @OneToMany(() => ChangeApproval, (a) => a.change) approvals?: ChangeApproval[];
  @OneToMany(() => ChangeTask, (t) => t.change) tasks?: ChangeTask[];
  @OneToMany(() => ChangeWorkNote, (n) => n.change) workNotes?: ChangeWorkNote[];
}
