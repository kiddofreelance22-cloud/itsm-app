import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

/**
 * Urgency levels for SERVICE REQUESTS. Deliberately a separate table from the incident `urgencies`
 * master, so service-request urgency levels can be edited, reordered and colored independently
 * without impacting incidents.
 */
@Entity("service_urgencies")
export class ServiceUrgency {
  @PrimaryGeneratedColumn({ name: "urgency_id" }) urgencyId!: number;
  @Column({ name: "urgency_name" }) urgencyName!: string;
  @Column({ name: "urgency_code", unique: true }) urgencyCode!: string;
  @Column({ type: "text", nullable: true }) description?: string | null;
  @Column({ name: "order", default: 0 }) order!: number;
  @Column({ type: "varchar", length: 20, nullable: true }) color?: string | null;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
