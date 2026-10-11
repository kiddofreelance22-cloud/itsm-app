import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { WorkflowStep } from "./workflow-step.entity";

@Entity("workflow_conditions")
export class WorkflowCondition {
  @PrimaryGeneratedColumn({ name: "workflow_condition_id" })
  workflowConditionId!: number;

  @ManyToOne(() => WorkflowStep, { onDelete: "CASCADE" })
  @JoinColumn({ name: "activity_id" })
  activity!: WorkflowStep;

  @Column({ name: "condition_name" })
  conditionName!: string;

  @Column({ name: "expression", type: "text" })
  expression!: string;

  @ManyToOne(() => WorkflowStep, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "true_path_activity_id" })
  truePathActivity?: WorkflowStep;

  @ManyToOne(() => WorkflowStep, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "false_path_activity_id" })
  falsePathActivity?: WorkflowStep;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
