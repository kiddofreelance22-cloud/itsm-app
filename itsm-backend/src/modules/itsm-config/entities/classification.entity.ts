import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("classifications")
export class Classification {
  @PrimaryGeneratedColumn({ name: "classification_id" }) classificationId!: number;
  @Column() name!: string;
  @Column({ name: "parent_id", type: "int", nullable: true }) parentId!: number | null;
  @Column({ type: "smallint", default: 1 }) level!: number;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
