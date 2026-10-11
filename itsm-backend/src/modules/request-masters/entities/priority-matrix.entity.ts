import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Priority } from "../../priority/entities/priority.entity";
import { Impact } from "../../impact/entities/impact.entity";
import { Urgency } from "../../urgency/entities/urgency.entity";
@Entity("priority_matrices")
export class PriorityMatrix {
  @PrimaryGeneratedColumn({ name: "priority_matrix_id" }) priorityMatrixId!: number;
  @Column({ name: "urgency_id" }) urgencyId!: number;
  @Column({ name: "impact_id" }) impactId!: number;
  @Column({ name: "priority_id" }) priorityId!: number;
  @ManyToOne(() => Urgency, { eager: true, onDelete: "RESTRICT" }) @JoinColumn({ name: "urgency_id" }) urgency!: Urgency;
  @ManyToOne(() => Impact, { eager: true, onDelete: "RESTRICT" }) @JoinColumn({ name: "impact_id" }) impact!: Impact;
  @ManyToOne(() => Priority, { eager: true, onDelete: "RESTRICT" }) @JoinColumn({ name: "priority_id" }) priority!: Priority;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}