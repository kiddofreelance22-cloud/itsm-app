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

export type CatalogVariableFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "dropdown"
  | "checkbox"
  | "radio";

@Entity("catalog_variables")
export class CatalogVariable {
  @PrimaryGeneratedColumn({ name: "variable_id" })
  variableId!: number;

  @ManyToOne(() => Catalog, (catalog) => catalog.variables, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "catalog_id" })
  catalog!: Catalog;

  @Column()
  label!: string;

  @Column({ name: "field_type" })
  fieldType!: CatalogVariableFieldType;

  @Column({ name: "is_mandatory", default: false })
  isMandatory!: boolean;

  @Column({ name: "default_value", nullable: true })
  defaultValue!: string;

  @Column({ name: "sort_order", default: 0 })
  sortOrder!: number;

  @Column({ name: "is_active", default: true })
  isActive!: boolean;

  @OneToMany(() => CatalogVariableOption, (option) => option.variable, {
    cascade: true,
  })
  options!: CatalogVariableOption[];
}
