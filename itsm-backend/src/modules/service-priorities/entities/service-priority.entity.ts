import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

/**
 * Priority levels for SERVICE REQUESTS. Deliberately a separate table from the incident `priorities`
 * master, so service-request priorities, their SLA minutes and their colours can be changed without
 * touching incidents (and the other way round). Property names match the incident entity so the
 * request screens keep reading `priority.priorityName`, `priority.responseSlaMinutes`, etc.
 */
@Entity("service_priorities")
export class ServicePriority {
  @PrimaryGeneratedColumn({ name: "priority_id" }) priorityId!: number;
  @Column({ name: "priority_name" }) priorityName!: string;
  @Column({ name: "priority_code", unique: true }) priorityCode!: string;
  @Column({ type: "text", nullable: true }) description?: string | null;
  @Column({ name: "display_order", default: 0 }) order!: number;
  @Column({ name: "response_sla_minutes", type: "int", nullable: true }) responseSlaMinutes?: number | null;
  @Column({ name: "resolution_sla_minutes", type: "int", nullable: true }) resolutionSlaMinutes?: number | null;
  @Column({ type: "varchar", length: 20, nullable: true }) color?: string | null;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
