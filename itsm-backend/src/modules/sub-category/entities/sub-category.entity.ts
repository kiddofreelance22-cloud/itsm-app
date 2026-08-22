import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { Category } from "../../categories/entities/category.entity";

@Entity("sub_categories")
export class SubCategory {
  @PrimaryGeneratedColumn({ name: "sub_category_id" }) subCategoryId!: number;
  @Column({ name: "sub_category_name" }) subCategoryName!: string;
  @Column({ name: "sub_category_code", unique: true }) subCategoryCode!: string;
  @Column({ nullable: true }) description!: string;
  @ManyToOne(() => Category, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "category_id" }) category?: Category;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
