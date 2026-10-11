import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("service_completions")
export class ServiceCompletion {
  @PrimaryGeneratedColumn({ name: "service_completion_id" }) serviceCompletionId!: number;
  @Column({ name: "completion_name", unique: true }) completionName!: string;
  @Column({ type: "text", nullable: true }) description?: string;
  @Column({ name: "sort_order", default: 0 }) sortOrder!: number;
  @Column({ name: "is_default", default: false }) isDefault!: boolean;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}