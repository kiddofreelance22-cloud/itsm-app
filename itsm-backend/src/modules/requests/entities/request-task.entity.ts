import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { ServiceRequest } from "./request.entity";
import { User } from "../../users/entities/user.entity";

export type RequestTaskStatus = "Open" | "In Progress" | "Completed" | "Cancelled";

/** Fulfilment task on a request, created from workflow task templates. */
@Entity("request_tasks")
export class RequestTask {
  @PrimaryGeneratedColumn({ name: "request_task_id" }) requestTaskId!: number;
  @ManyToOne(() => ServiceRequest, (r) => r.tasks, { onDelete: "CASCADE" }) @JoinColumn({ name: "request_id" }) request!: ServiceRequest;
  @Column({ name: "workflow_task_id", type: "int", nullable: true }) workflowTaskId?: number | null;
  @Column({ name: "task_name" }) taskName!: string;
  @Column({ type: "text", nullable: true }) description?: string | null;
  @Column({ name: "assignee_type", type: "varchar", nullable: true }) assigneeType?: "user" | "group" | "role" | null;
  @Column({ name: "assignee_id", type: "int", nullable: true }) assigneeId?: number | null;
  @Column({ type: "varchar", default: "Open" }) status!: RequestTaskStatus;
  @Column({ default: "medium" }) priority!: string;
  @Column({ name: "sort_order", default: 0 }) sortOrder!: number;
  @Column({ name: "due_at", type: "timestamp", nullable: true }) dueAt?: Date | null;
  @Column({ name: "completed_at", type: "timestamp", nullable: true }) completedAt?: Date | null;
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" }) @JoinColumn({ name: "completed_by" }) completedBy?: User | null;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
