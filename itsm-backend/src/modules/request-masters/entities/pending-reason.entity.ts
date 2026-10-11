import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
@Entity("pending_reasons")
export class PendingReason {
  @PrimaryGeneratedColumn({ name: "pending_reason_id" }) pendingReasonId!: number;
  @Column({ name: "pending_reason_name", unique: true }) pendingReasonName!: string;
  @Column({ type: "text", nullable: true }) description?: string | null;
  @Column({ name: "display_order", default: 0 }) displayOrder!: number;
  @Column({ name: "sla_impact", default: "pause" }) slaImpact!: "pause" | "continue";
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}