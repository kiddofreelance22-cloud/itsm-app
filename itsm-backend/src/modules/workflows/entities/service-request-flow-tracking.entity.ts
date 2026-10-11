import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { ServiceRequest } from "../../requests/entities/request.entity";
import { Catalog } from "../../catalogs/entities/catalog.entity";
import { Workflow } from "./workflow.entity";
import { WorkflowStep } from "./workflow-step.entity";

@Entity("service_request_flow_tracking")
export class ServiceRequestFlowTracking {
  @PrimaryGeneratedColumn({ name: "tracking_id" })
  trackingId!: number;

  @ManyToOne(() => ServiceRequest, { onDelete: "CASCADE" })
  @JoinColumn({ name: "service_request_id" })
  serviceRequest!: ServiceRequest;

  @ManyToOne(() => Catalog, { onDelete: "CASCADE" })
  @JoinColumn({ name: "catalog_id" })
  catalog!: Catalog;

  @ManyToOne(() => Workflow, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "workflow_id" })
  workflow?: Workflow;

  @ManyToOne(() => WorkflowStep, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "current_activity_id" })
  currentActivity?: WorkflowStep;

  @Column({ name: "current_step", type: "varchar", length: 50, default: "in_progress" })
  currentStep!: string;

  @Column({ name: "status", type: "varchar", length: 20, default: "in_progress" })
  status!: string; // in_progress, completed, cancelled, failed

  @CreateDateColumn({ name: "started_at" })
  startedAt!: Date;

  @Column({ name: "completed_at", type: "timestamp", nullable: true })
  completedAt?: Date;

  @Column({ type: "text", nullable: true })
  errorMessage?: string;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, unknown>;
}
