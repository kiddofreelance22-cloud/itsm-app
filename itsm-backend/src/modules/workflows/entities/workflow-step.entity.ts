import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { Workflow } from "./workflow.entity";
import { Role } from "../../roles/entities/role.entity";
import { ApprovalLevel } from "./approval-level.entity";

export type WorkflowStepType = "approval" | "task" | "notification" | "condition" | "wait" | "subflow" | "update";

@Entity("workflow_steps")
export class WorkflowStep {
  @PrimaryGeneratedColumn({ name: "workflow_step_id" })
  workflowStepId!: number;

  @ManyToOne(() => Workflow, (workflow) => workflow.steps, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "workflow_id" })
  workflow!: Workflow;

  @Column({ name: "step_name" })
  stepName!: string;

  @Column({ name: "step_order" })
  stepOrder!: number;

  @Column({ name: "step_type" })
  stepType!: WorkflowStepType;

  @Column({ name: "condition_expression", type: "text", nullable: true })
  conditionExpression?: string;

  @ManyToOne(() => Role, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "approver_role_id" })
  approverRole?: Role;

  // --- Added for the visual workflow editor (React Flow) ---
  // The execution engine (workflows.service.ts) only reads stepType/
  // conditionExpression/approverRole above; these columns are additive
  // metadata so the canvas can persist and restore the full node palette
  // (http, webhook, cron, code, database, file ops, transform, loop, etc.)
  // without changing existing execution semantics.

  /** Visual node kind, e.g. "httpRequest", "code", "loop" — see NodeKind on the frontend. */
  @Column({ name: "node_kind", type: "varchar", length: 64, nullable: true })
  nodeKind?: string;

  /** Free-form per-node-kind configuration (URL/method, script, query, etc). */
  @Column({ name: "config", type: "jsonb", nullable: true })
  config?: Record<string, unknown>;

  /** Canvas position, so layout survives a reload instead of being re-computed. */
  @Column({ name: "position_x", type: "double precision", nullable: true })
  positionX?: number;

  @Column({ name: "position_y", type: "double precision", nullable: true })
  positionY?: number;

  @OneToMany(() => ApprovalLevel, (level) => level.activity)
  approvalLevels?: ApprovalLevel[];
}
