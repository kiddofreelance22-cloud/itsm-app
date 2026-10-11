import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { WorkflowStep } from "./workflow-step.entity";

export type AssigneeType = "user" | "group" | "role";
export type TaskPriority = "low" | "medium" | "high" | "critical";

@Entity("workflow_tasks")
export class WorkflowTask {
  @PrimaryGeneratedColumn({ name: "workflow_task_id" })
  workflowTaskId!: number;

  @ManyToOne(() => WorkflowStep, { onDelete: "CASCADE" })
  @JoinColumn({ name: "activity_id" })
  activity!: WorkflowStep;

  @Column({ name: "task_name" })
  taskName!: string;

  @Column({ type: "text", nullable: true })
  description!: string;

  @Column({ name: "assignee_type" })
  assigneeType!: AssigneeType;

  @Column({ name: "assignee_id", nullable: true })
  assigneeId?: number;

  @Column({ name: "due_date_hours", nullable: true })
  dueDateHours?: number;

  @Column({ default: "medium" })
  priority!: TaskPriority;

  @Column({ type: "jsonb", nullable: true })
  checklists?: Record<string, unknown>;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
