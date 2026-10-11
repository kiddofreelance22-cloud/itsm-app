import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";
@Entity("priorities")
export class Priority {
  @PrimaryGeneratedColumn({ name: "priority_id" }) priorityId!: number;
  @Column({ name: "priority_name" }) priorityName!: string;
  @Column({ name: "priority_code", unique: true }) priorityCode!: string;
  @Column({ nullable: true }) description!: string;
  @Column({ name: "order", default: 0 }) order!: number;
  // Response & Resolution SLA, defined per priority level (e.g. Critical = respond
  // in 15 min / resolve in 4h, Low = respond in 4h / resolve in 5 days).
  @Column({ name: "response_sla_minutes", nullable: true }) responseSlaMinutes?: number;
  @Column({ name: "resolution_sla_minutes", nullable: true }) resolutionSlaMinutes?: number;
  @Column({ type: "varchar", length: 20, nullable: true }) color?: string | null;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
