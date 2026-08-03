import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { Category } from "../../categories/entities/category.entity";
import { Workflow } from "../../workflows/entities/workflow.entity";
import { CatalogVariable } from "./catalog-variable.entity";

@Entity("catalogs")
export class Catalog {
  @PrimaryGeneratedColumn({ name: "catalog_id" })
  catalogId: number;

  @Column({ name: "catalog_name" })
  catalogName: string;

  @Column({ name: "short_description", nullable: true })
  shortDescription: string;

  @Column({ nullable: true })
  description: string;

  @ManyToOne(() => Category, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "category_id" })
  category: Category;

  @Column({ name: "icon_url", nullable: true })
  iconUrl: string;

  @ManyToOne(() => Workflow, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "workflow_id" })
  workflow: Workflow | null;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @OneToMany(() => CatalogVariable, (variable) => variable.catalog, {
    cascade: true,
  })
  variables: CatalogVariable[];
}
