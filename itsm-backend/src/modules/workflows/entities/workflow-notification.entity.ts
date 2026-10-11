import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { WorkflowStep } from "./workflow-step.entity";

export type RecipientType = "requestor" | "approver" | "assignee" | "custom";

@Entity("workflow_notifications")
export class WorkflowNotification {
  @PrimaryGeneratedColumn({ name: "workflow_notification_id" })
  workflowNotificationId!: number;

  @ManyToOne(() => WorkflowStep, { onDelete: "CASCADE" })
  @JoinColumn({ name: "activity_id" })
  activity!: WorkflowStep;

  @Column({ name: "notification_name" })
  notificationName!: string;

  @Column({ name: "recipient_type" })
  recipientType!: RecipientType;

  @Column({ name: "recipient_ids", type: "jsonb", nullable: true })
  recipientIds?: Record<string, unknown>;

  @Column({ name: "subject", length: 500, nullable: true })
  subject?: string;

  @Column({ type: "text", nullable: true })
  body?: string;

  @Column({ name: "trigger_events", type: "jsonb", nullable: true })
  triggerEvents?: Record<string, unknown>;

  @Column({ name: "attachment_ids", type: "jsonb", nullable: true })
  attachmentIds?: Record<string, unknown>;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
