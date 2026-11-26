import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from "typeorm";
import { Category } from "../../categories/entities/category.entity";
import { SubCategory } from "../../sub-category/entities/sub-category.entity";
import { Workflow } from "../../workflows/entities/workflow.entity";
import { AssignmentGroup } from "../../assignment-group/entities/assignment-group.entity";
import { ServicePriority } from "../../service-priorities/entities/service-priority.entity";
import { Impact } from "../../impact/entities/impact.entity";
import { ServiceImpact } from "../../service-impacts/entities/service-impact.entity";
import { ServiceUrgency } from "../../service-urgencies/entities/service-urgency.entity";
import { CatalogVariable } from "./catalog-variable.entity";
import { CatalogFormSection } from "./catalog-form-section.entity";
import { CatalogAttachment } from "./catalog-attachment.entity";
import { ServiceCategory } from "../../service-categories/entities/service-category.entity";
import { CatalogType } from "./catalog-type.entity";

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

  // Category for this catalog item, picked from the existing, already-
  // populated Incident category tree (Category / `categories` table) —
  // same shared tree used by Incidents, with the same parent/child picker
  // UX. The old separate "Catalog" (top-level grouping) dropdown has been
  // removed; there is no separate catalog-only category table.
  @ManyToOne(() => Category, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "category_id" })
  category?: Category;

  @ManyToOne(() => ServiceCategory, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "service_category_id" })
  serviceCategory?: ServiceCategory;

  @ManyToOne(() => SubCategory, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "sub_category_id" })
  subCategory?: SubCategory;

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

  @Column({ name: "tile_color", type: "varchar", length: 7, nullable: true })
  tileColor!: string;

  @ManyToOne(() => CatalogType, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "catalog_type_id" })
  catalogType?: CatalogType;

  // ── Additional Info ───────────────────────────────────────────────────────
  @Column({ name: "request_type", type: "varchar", default: "Access" })
  requestType!: string;

  @Column({ name: "approval_required", type: "boolean", default: false })
  approvalRequired!: boolean;

  @Column({ name: "stage", type: "varchar", default: "Production" })
  stage!: string;

  @ManyToOne(() => ServicePriority, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "priority_id" })
  priority?: ServicePriority;

  @ManyToOne(() => Impact, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "impact_id" })
  impact?: Impact;

  /** Default SERVICE impact for requests raised from this item (separate from the incident impact above). */
  @ManyToOne(() => ServiceImpact, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "service_impact_id" })
  serviceImpact?: ServiceImpact;

  @ManyToOne(() => ServiceUrgency, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "urgency_id" })
  urgency?: ServiceUrgency;

  @Column({ name: "sla_name", type: "varchar", nullable: true })
  slaName!: string;

  @Column({ name: "tags", type: "text", array: true, nullable: true })
  tags!: string[];

  @Column({ name: "keywords", type: "text", nullable: true })
  keywords!: string;

  @Column({ name: "enable_bulk_sr_creation", type: "boolean", default: false })
  enableBulkSrCreation!: boolean;

  @ManyToOne(() => Category, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "link_to_other_category_id" })
  linkToOtherCategory?: Category;

  @Column({ name: "status", type: "varchar", length: 20, default: "draft" })
  status!: string;

  @Column({ name: "visibility", type: "varchar", length: 20, default: "public" })
  visibility!: string;

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

  @Column({ name: "estimated_cost", type: "numeric", precision: 12, scale: 2, nullable: true })
  estimatedCost?: string | number | null;

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

  // ── Variables (Form) settings ────────────────────────────────────────────
  @Column({ name: "show_section_numbers", type: "boolean", default: true })
  showSectionNumbers!: boolean;

  @Column({ name: "show_progress_indicator", type: "boolean", default: true })
  showProgressIndicator!: boolean;

  @Column({ name: "collapse_all_sections", type: "boolean", default: false })
  collapseAllSections!: boolean;

  @Column({ name: "make_fields_mandatory", type: "boolean", default: false })
  makeFieldsMandatory!: boolean;

  @Column({ name: "form_layout", type: "varchar", default: "single" })
  formLayout!: "single" | "two-column" | string;

  // ── Timestamps ────────────────────────────────────────────────────────────
  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @OneToMany(() => CatalogVariable, (v) => v.catalog, { cascade: true })
  variables!: CatalogVariable[];

  @OneToMany(() => CatalogFormSection, (s) => s.catalog, { cascade: true })
  sections!: CatalogFormSection[];

  @OneToMany(() => CatalogAttachment, (a) => a.catalog, { cascade: true })
  attachments!: CatalogAttachment[];
}
