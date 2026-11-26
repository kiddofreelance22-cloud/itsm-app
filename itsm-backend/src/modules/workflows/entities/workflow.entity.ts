import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { WorkflowStep } from "./workflow-step.entity";
import { WorkflowTransition } from "./workflow-transition.entity";
import { Role } from "../../roles/entities/role.entity";
import { Catalog } from "../../catalogs/entities/catalog.entity";

@Entity("workflows")
export class Workflow {
  @PrimaryGeneratedColumn({ name: "workflow_id" })
  workflowId!: number;

  @Column({ name: "workflow_name" })
  workflowName!: string;

  @Column({ name: "workflow_scope", type: "varchar", length: 30, default: "service_request" })
  workflowScope!: "service_request" | "knowledge";

  @Column({ nullable: true })
  description!: string;

  @Column({ name: "is_active", default: true })
  isActive!: boolean;

  @Column({ name: "status", type: "varchar", length: 20, default: "draft" })
  status!: string;

  @Column({ name: "version", default: 1 })
  version!: number;

  @ManyToOne(() => Catalog, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "associated_catalog_id" })
  associatedCatalog?: Catalog;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @OneToMany(() => WorkflowStep, (step) => step.workflow, { cascade: true })
  steps!: WorkflowStep[];

  @OneToMany(() => WorkflowTransition, (transition) => transition.workflow, { cascade: true })
  transitions!: WorkflowTransition[];

  // --- Added: workflow-level approval gate ---
  // When true, a request against this workflow sits in "Pending Approval"
  // (see ServiceRequest.status) before any step runs at all — a single
  // approve/reject on the request as a whole, independent of the per-step
  // `approval` step type already supported on WorkflowStep.

  @Column({ name: "requires_approval", default: false })
  requiresApproval!: boolean;

  @ManyToOne(() => Role, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "approver_role_id" })
  approverRole?: Role;
}

