import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import { ServiceUrgency } from "../../service-urgencies/entities/service-urgency.entity";
import { ServiceImpact } from "../../service-impacts/entities/service-impact.entity";
import { ServicePriority } from "../../service-priorities/entities/service-priority.entity";

/** Service-request priority: SERVICE urgency x SERVICE impact (not the incident urgency or impact). */
@Entity("request_priority_matrices")
@Unique("uq_request_priority_matrix", ["urgencyId", "serviceImpactId"])
export class RequestPriorityMatrix {
  @PrimaryGeneratedColumn({ name: "request_priority_matrix_id" }) requestPriorityMatrixId!: number;
  @Column({ name: "urgency_id" }) urgencyId!: number;
  @Column({ name: "service_impact_id" }) serviceImpactId!: number;
  @Column({ name: "priority_id" }) priorityId!: number;
  @ManyToOne(() => ServiceUrgency, { eager: true, onDelete: "RESTRICT" }) @JoinColumn({ name: "urgency_id" }) urgency!: ServiceUrgency;
  @ManyToOne(() => ServiceImpact, { eager: true, onDelete: "RESTRICT" }) @JoinColumn({ name: "service_impact_id" }) serviceImpact!: ServiceImpact;
  @ManyToOne(() => ServicePriority, { eager: true, onDelete: "RESTRICT" }) @JoinColumn({ name: "priority_id" }) priority!: ServicePriority;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
