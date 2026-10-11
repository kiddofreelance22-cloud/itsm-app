import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { Catalog } from "./catalog.entity";
import { CatalogVariable } from "./catalog-variable.entity";

@Entity("catalog_form_sections")
export class CatalogFormSection {
  @PrimaryGeneratedColumn({ name: "section_id" })
  sectionId!: number;

  @ManyToOne(() => Catalog, (catalog) => catalog.sections, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "catalog_id" })
  catalog!: Catalog;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description!: string;

  @Column({ name: "display_order", default: 0 })
  displayOrder!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @OneToMany(() => CatalogVariable, (v) => v.section)
  variables!: CatalogVariable[];
}
