import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Catalog } from "../../catalogs/entities/catalog.entity";
import { User } from "../../users/entities/user.entity";
import { WorkflowStep } from "../../workflows/entities/workflow-step.entity";
import { RequestVariableValue } from "./request-variable-value.entity";

export type RequestStatus =
  | "Submitted"
  | "In Progress"
  | "Approved"
  | "Rejected"
  | "Closed";

@Entity("requests")
export class ServiceRequest {
  @PrimaryGeneratedColumn({ name: "request_id" })
  requestId: number;

  @ManyToOne(() => Catalog, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "catalog_id" })
  catalog: Catalog;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "requested_by" })
  requestedBy: User;

  @Column({ default: "Submitted" })
  status: RequestStatus;

  @ManyToOne(() => WorkflowStep, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "current_step_id" })
  currentStep: WorkflowStep | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({
  name: "closed_at",
  type: "timestamp",
  nullable: true,
})
closedAt: Date | null;

  @OneToMany(() => RequestVariableValue, (value) => value.request, {
    cascade: true,
  })
  variableValues: RequestVariableValue[];
}
