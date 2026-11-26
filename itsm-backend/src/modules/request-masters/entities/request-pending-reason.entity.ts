import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

/**
 * Why a SERVICE REQUEST is put on hold. A separate table from the incident `pending_reasons` master, so the
 * two lists are maintained independently. Property names match the incident entity, which keeps the
 * `pendingReason` field of a request unchanged for the screens that read it.
 */
@Entity("request_pending_reasons")
export class RequestPendingReason {
  @PrimaryGeneratedColumn({ name: "pending_reason_id" }) pendingReasonId!: number;
  @Column({ name: "pending_reason_name", unique: true }) pendingReasonName!: string;
  @Column({ type: "text", nullable: true }) description?: string | null;
  @Column({ name: "display_order", default: 0 }) displayOrder!: number;
  @Column({ name: "sla_impact", default: "pause" }) slaImpact!: "pause" | "continue";
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
