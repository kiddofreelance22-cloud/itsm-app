import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("service_categories")
export class ServiceCategory {
  @PrimaryGeneratedColumn({ name: "service_category_id" }) serviceCategoryId!: number;
  @Column({ name: "category_name", unique: true }) categoryName!: string;
  @Column({ name: "parent_category_id", nullable: true }) parentCategoryId?: number;
  @ManyToOne(() => ServiceCategory, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "parent_category_id" })
  parentCategory?: ServiceCategory;
  @Column({ type: "text", nullable: true }) description?: string;
  @Column({ name: "image_url", nullable: true }) imageUrl?: string;
  @Column({ name: "tile_color", length: 20, default: "#111827" }) tileColor!: string;
  @Column({ name: "sort_order", default: 0 }) sortOrder!: number;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}