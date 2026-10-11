import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn, BeforeInsert,
} from "typeorm";
import { randomUUID } from "crypto";
import { AssignmentGroup } from "../../assignment-group/entities/assignment-group.entity";

@Entity("categories")
export class Category {
  @PrimaryGeneratedColumn({ name: "category_id" })
  categoryId!: number;

  /**
   * Immutable, DB-independent identifier for this node. Positional /
   * auto-increment `categoryId` values can be re-indexed by the DB when
   * rows move around; `nodeUuid` never changes for the lifetime of the
   * node, so front-end state (e.g. an expanded tree, an in-flight edit
   * panel) can always re-associate itself with the right node even after
   * a parent relocation triggers a re-hydration of the tree.
   */
  @Column({ name: "node_uuid", type: "uuid", unique: true })
  nodeUuid!: string;

  @BeforeInsert()
  assignNodeUuid() {
    if (!this.nodeUuid) this.nodeUuid = randomUUID();
  }

  /**
   * Materialized path of category_ids from root to this node, e.g. "/1/4/12/".
   * Rebuilt (for this node and every descendant) any time the node is
   * moved to a new parent — see CategoriesService.reparentSubtree().
   */
  @Column({ name: "materialized_path", type: "text", nullable: true })
  materializedPath!: string;

  @Column({ name: "category_name" })
  categoryName!: string;

  @Column({
    name: "category_code",
    type: "varchar",
    unique: true,
    nullable: true,
  })
  categoryCode!: string;

  @Column({ type: "text", nullable: true })
  description!: string;

  @ManyToOne(() => Category, (c) => c.children, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "parent_category_id" })
  parent?: Category | null;

  @Column({ name: "parent_category_id", type: "int", nullable: true })
  parentCategoryId!: number | null;

  @OneToMany(() => Category, (c) => c.parent)
  children!: Category[];

  @Column({ name: "display_order", default: 0 })
  displayOrder!: number;

  @Column({
    type: "varchar",
    nullable: true,
  })
  icon!: string;

  @Column({ name: "is_active", default: true })
  isActive!: boolean;

  @Column({ name: "available_in_portal", default: true })
  availableInPortal!: boolean;

  @Column({ name: "available_in_mobile", default: true })
  availableInMobile!: boolean;

  @Column({ name: "show_in_catalog", default: true })
  showInCatalog!: boolean;

  @Column({ name: "allow_in_incident", default: true })
  allowInIncident!: boolean;

  // ── Granular scope overrides (all optional) ──────────────────────────────
  // When left empty/null, the node inherits its effective scope from the
  // nearest ancestor that *does* define one (see CategoriesService.effectiveScope).
  @Column({ name: "workgroup_ids", type: "int", array: true, nullable: true })
  workgroupIds!: number[] | null;

  @Column({ name: "location_ids", type: "int", array: true, nullable: true })
  locationIds!: number[] | null;

  @Column({ name: "member_ids", type: "int", array: true, nullable: true })
  memberIds!: number[] | null;

  /**
   * The assignment group an incident should be routed to when it's filed
   * against this category (or, if unset, the nearest ancestor category
   * that does set one — see CategoriesService.getEffectiveAssignmentGroupId).
   * Independent from workgroupIds above, which controls category
   * *visibility*, not incident *routing*.
   */
  @ManyToOne(() => AssignmentGroup, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "default_assignment_group_id" })
  defaultAssignmentGroup?: AssignmentGroup;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
