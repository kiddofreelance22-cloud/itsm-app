import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { ServiceRequest } from "./request.entity";
import { WorkflowStep } from "../../workflows/entities/workflow-step.entity";
import { User } from "../../users/entities/user.entity";

export type RequestHistoryAction =
  | "Submitted"
  | "Approved"
  | "Rejected"
  | "Commented"
  | "Reassigned"
  | "Closed";

@Entity("request_history")
export class RequestHistory {
  @PrimaryGeneratedColumn({ name: "history_id" })
  historyId!: number;

  @ManyToOne(() => ServiceRequest, { onDelete: "CASCADE" })
  @JoinColumn({ name: "request_id" })
  request!: ServiceRequest;

  @ManyToOne(() => WorkflowStep, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "workflow_step_id" })
  workflowStep?: WorkflowStep;

  @Column()
  action!: RequestHistoryAction;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "action_by" })
  actionBy!: User;

  @Column({ type: "text", nullable: true })
  comments?: string;

  @CreateDateColumn({ name: "action_at" })
  actionAt!: Date;
}
