import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from "typeorm";

@Entity("categories")
export class Category {
  @PrimaryGeneratedColumn({ name: "category_id" })
  categoryId!: number;

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
  parent?: Category;

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

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
