import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Workflow } from "./workflow.entity";
import { Role } from "../../roles/entities/role.entity";

export type WorkflowStepType = "approval" | "task" | "notification";

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

  @ManyToOne(() => Role, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "approver_role_id" })
  approverRole?: Role;
}
