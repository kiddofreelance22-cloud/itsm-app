import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

export type RequestStage = "approval" | "queue" | "work" | "hold" | "done" | "closed" | "stopped";

/** Statuses a service request can be in. System rows drive the lifecycle; custom rows live in the work/hold stages. */
@Entity("request_statuses")
export class RequestStatusConfig {
  @PrimaryGeneratedColumn({ name: "request_status_id" }) requestStatusId!: number;
  @Column({ name: "status_name", unique: true }) statusName!: string;
  @Column({ type: "text", nullable: true }) description?: string | null;
  @Column({ type: "varchar" }) stage!: RequestStage;
  @Column({ type: "varchar", default: "gray" }) color!: string;
  @Column({ name: "is_system", default: false }) isSystem!: boolean;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @Column({ name: "display_order", default: 0 }) displayOrder!: number;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
