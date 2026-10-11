import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Workflow } from "./workflow.entity";
import { WorkflowStep } from "./workflow-step.entity";

export type WorkflowTransitionBranch = "yes" | "no";

@Entity("workflow_transitions")
export class WorkflowTransition {
  @PrimaryGeneratedColumn({ name: "transition_id" })
  transitionId!: number;

  @ManyToOne(() => Workflow, (workflow) => workflow.transitions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workflow_id" })
  workflow!: Workflow;

  @ManyToOne(() => WorkflowStep, { onDelete: "CASCADE" })
  @JoinColumn({ name: "from_step_id" })
  fromStep!: WorkflowStep;

  @ManyToOne(() => WorkflowStep, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "to_step_id" })
  toStep?: WorkflowStep | null;

  @Column({ name: "branch", type: "varchar", length: 3 })
  branch!: WorkflowTransitionBranch;
}