import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { Catalog } from "./catalog.entity";
import { CatalogVariableOption } from "./catalog-variable-option.entity";
import { CatalogFormSection } from "./catalog-form-section.entity";

export type CatalogVariableFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "datetime"
  | "dropdown"
  | "multi_select"
  | "checkbox"
  | "radio"
  | "attachment"
  | "user_lookup"
  | "group_lookup"
  | "info";

@Entity("catalog_variables")
export class CatalogVariable {
  @PrimaryGeneratedColumn({ name: "variable_id" })
  variableId!: number;

  @ManyToOne(() => Catalog, (catalog) => catalog.variables, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "catalog_id" })
  catalog!: Catalog;

  @ManyToOne(() => CatalogFormSection, (section) => section.variables, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "section_id" })
  section?: CatalogFormSection;

  // Kept alongside `section` for backward compatibility with the UI's
  // original string-grouping model, and as a fallback label for variables
  // that aren't attached to a real CatalogFormSection. Kept in sync with
  // `section.name` by the service whenever a section relation is set.
  @Column({ name: "section_name", nullable: true, default: "General" })
  sectionName!: string;

  @Column()
  label!: string;

  @Column({ name: "field_type" })
  fieldType!: CatalogVariableFieldType;

  @Column({ name: "is_mandatory", default: false })
  isMandatory!: boolean;

  @Column({ name: "default_value", nullable: true })
  defaultValue!: string;

  @Column({ nullable: true })
  placeholder!: string;

  @Column({ name: "help_text", nullable: true })
  helpText!: string;

  @Column({ name: "is_visible", default: true })
  isVisible!: boolean;

  @Column({ name: "read_only", default: false })
  readOnly!: boolean;

  @Column({ name: "sort_order", default: 0 })
  sortOrder!: number;

  @Column({ name: "is_active", default: true })
  isActive!: boolean;

  // ── number ───────────────────────────────────────────────────────────────
  @Column({ name: "min_value", nullable: true })
  minValue!: string;

  @Column({ name: "max_value", nullable: true })
  maxValue!: string;

  // ── text / textarea ──────────────────────────────────────────────────────
  @Column({ name: "validation_regex", nullable: true })
  validationRegex!: string;

  // ── date / datetime ──────────────────────────────────────────────────────
  @Column({ name: "date_min", type: "date", nullable: true })
  dateMin!: string;

  @Column({ name: "date_max", type: "date", nullable: true })
  dateMax!: string;

  // ── attachment ───────────────────────────────────────────────────────────
  @Column({ name: "allowed_file_types", nullable: true })
  allowedFileTypes!: string; // comma-separated, e.g. ".pdf,.png,.jpg"

  @Column({ name: "max_file_size_mb", nullable: true })
  maxFileSizeMb!: number;

  // ── user_lookup / group_lookup ───────────────────────────────────────────
  // Free-text hint only (e.g. a department to filter by); the actual list of
  // users/groups always comes live from the Users / Assignment Groups APIs,
  // never hard-coded.
  @Column({ name: "lookup_source", nullable: true })
  lookupSource!: string;

  // ── Form builder enhancements ───────────────────────────────────────────────
  @Column({ name: "size", type: "varchar", length: 20, default: "medium" })
  size!: string;

  @Column({ name: "tooltip_text", type: "text", nullable: true })
  tooltipText!: string;

  @Column({ name: "only_integers", type: "boolean", default: false })
  onlyIntegers!: boolean;

  @Column({ name: "update_by", type: "varchar", length: 20, default: "end_user" })
  updateBy!: string;

  @Column({ name: "is_unique", type: "boolean", default: false })
  isUnique!: boolean;

  @Column({ name: "display_in_email", type: "boolean", default: false })
  displayInEmail!: boolean;

  @Column({ name: "auto_populate", type: "boolean", default: false })
  autoPopulate!: boolean;

  @OneToMany(() => CatalogVariableOption, (option) => option.variable, {
    cascade: true,
  })
  options!: CatalogVariableOption[];
}
