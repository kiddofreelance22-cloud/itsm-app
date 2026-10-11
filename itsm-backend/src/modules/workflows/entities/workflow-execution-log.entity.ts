import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { Workflow } from "./workflow.entity";
import { ServiceRequest } from "../../requests/entities/request.entity";
import { WorkflowStep } from "./workflow-step.entity";
import { User } from "../../users/entities/user.entity";

@Entity("workflow_execution_log")
export class WorkflowExecutionLog {
  @PrimaryGeneratedColumn({ name: "execution_log_id" })
  executionLogId!: number;

  @ManyToOne(() => Workflow, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workflow_id" })
  workflow!: Workflow;

  @ManyToOne(() => ServiceRequest, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "service_request_id" })
  serviceRequest?: ServiceRequest;

  @ManyToOne(() => WorkflowStep, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "activity_id" })
  activity?: WorkflowStep;

  @Column({ name: "action", type: "varchar", length: 100 })
  action!: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "performed_by_id" })
  performedBy?: User;

  @Column({ nullable: true })
  result?: string; // success, failure, pending

  @Column({ type: "text", nullable: true })
  errorMessage?: string;

  @Column({ name: "execution_time_ms", nullable: true })
  executionTimeMs?: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
