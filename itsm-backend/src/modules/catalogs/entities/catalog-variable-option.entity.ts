import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { CatalogVariable } from "./catalog-variable.entity";

@Entity("catalog_variable_options")
export class CatalogVariableOption {
  @PrimaryGeneratedColumn({ name: "option_id" })
  optionId!: number;

  @ManyToOne(() => CatalogVariable, (variable) => variable.options, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "variable_id" })
  variable!: CatalogVariable;

  @Column({ name: "option_label" })
  optionLabel!: string;

  @Column({ name: "option_value" })
  optionValue!: string;

  @Column({ name: "sort_order", default: 0 })
  sortOrder!: number;
}
