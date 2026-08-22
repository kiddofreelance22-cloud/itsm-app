import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from "typeorm";
import { Category } from "../../categories/entities/category.entity";
import { Workflow } from "../../workflows/entities/workflow.entity";
import { AssignmentGroup } from "../../assignment-group/entities/assignment-group.entity";
import { CatalogVariable } from "./catalog-variable.entity";

@Entity("catalogs")
export class Catalog {
  @PrimaryGeneratedColumn({ name: "catalog_id" })
  catalogId!: number;

  // ── Basic Info ────────────────────────────────────────────────────────────
  @Column({ name: "catalog_name", type: "varchar" })
  catalogName!: string;

  @Column({ name: "catalog_code", type: "varchar", nullable: true })
  catalogCode!: string;

  @Column({ name: "short_description", type: "varchar", nullable: true })
  shortDescription!: string;

  @Column({ type: "text", nullable: true })
  description!: string;

  @ManyToOne(() => Category, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "category_id" })
  category?: Category;

  @Column({ name: "sub_category", type: "varchar", nullable: true })
  subCategory!: string;

  @Column({ name: "item_type", type: "varchar", default: "Standard" })
  itemType!: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "allow_requested_for", type: "boolean", default: true })
  allowRequestedFor!: boolean;

  @Column({ name: "icon_url", type: "varchar", nullable: true })
  iconUrl!: string;

  @Column({ name: "banner_url", type: "varchar", nullable: true })
  bannerUrl!: string;

  // ── Additional Info ───────────────────────────────────────────────────────
  @Column({ name: "request_type", type: "varchar", default: "Access" })
  requestType!: string;

  @Column({ name: "approval_required", type: "boolean", default: false })
  approvalRequired!: boolean;

  @Column({ name: "stage", type: "varchar", default: "Production" })
  stage!: string;

  @Column({ name: "impact", type: "varchar", default: "Medium" })
  impact!: string;

  @Column({ name: "urgency", type: "varchar", default: "Medium" })
  urgency!: string;

  @Column({ name: "default_priority", type: "varchar", default: "P3 - Moderate" })
  defaultPriority!: string;

  @Column({ name: "sla_name", type: "varchar", nullable: true })
  slaName!: string;

  @Column({ name: "tags", type: "text", array: true, nullable: true })
  tags!: string[];

  @Column({ name: "keywords", type: "text", nullable: true })
  keywords!: string;

  // ── Service Offering ──────────────────────────────────────────────────────
  @Column({ name: "service_offering", type: "varchar", nullable: true })
  serviceOffering!: string;

  @Column({ name: "business_service", type: "varchar", nullable: true })
  businessService!: string;

  @Column({ name: "configuration_item", type: "varchar", nullable: true })
  configurationItem!: string;

  // ── Time / Cost ───────────────────────────────────────────────────────────
  @Column({ name: "estimated_time", type: "int", nullable: true, default: 2 })
  estimatedTime!: number;

  @Column({ name: "delivery_time_sla", type: "int", nullable: true, default: 4 })
  deliveryTimeSla!: number;

  @Column({ name: "hide_price", type: "boolean", default: false })
  hidePrice!: boolean;

  // ── Workflow Configuration ─────────────────────────────────────────────────
  @ManyToOne(() => Workflow, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "workflow_id" })
  workflow?: Workflow;

  @Column({ name: "approval_policy", type: "varchar", nullable: true })
  approvalPolicy!: string;

  @ManyToOne(() => Workflow, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "fulfillment_workflow_id" })
  fulfillmentWorkflow?: Workflow;

  // ── Assignment ────────────────────────────────────────────────────────────
  @ManyToOne(() => AssignmentGroup, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "fulfillment_group_id" })
  fulfillmentGroup?: AssignmentGroup;

  @ManyToOne(() => AssignmentGroup, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "assignment_group_id" })
  assignmentGroup?: AssignmentGroup;

  // ── Visibility ────────────────────────────────────────────────────────────
  @Column({ name: "available_in_portal", type: "boolean", default: true })
  availableInPortal!: boolean;

  @Column({ name: "available_in_mobile", type: "boolean", default: true })
  availableInMobile!: boolean;

  @Column({ name: "show_in_catalog", type: "boolean", default: true })
  showInCatalog!: boolean;

  @Column({ name: "show_in_popular", type: "boolean", default: false })
  showInPopular!: boolean;

  @Column({ name: "requires_approval_for", type: "boolean", default: false })
  requiresApprovalFor!: boolean;

  @Column({ name: "allow_requests_for_others", type: "boolean", default: true })
  allowRequestsForOthers!: boolean;

  @Column({ name: "enable_discussion", type: "boolean", default: false })
  enableDiscussion!: boolean;

  @Column({ name: "visible_to", type: "varchar", default: "All Users" })
  visibleTo!: string;

  @Column({ name: "user_groups", type: "text", array: true, nullable: true })
  userGroups!: string[];

  @Column({ name: "departments", type: "text", array: true, nullable: true })
  departments!: string[];

  @Column({ name: "locations", type: "text", array: true, nullable: true })
  locations!: string[];

  // ── Timestamps ────────────────────────────────────────────────────────────
  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @OneToMany(() => CatalogVariable, (v) => v.catalog, { cascade: true })
  variables!: CatalogVariable[];
}
