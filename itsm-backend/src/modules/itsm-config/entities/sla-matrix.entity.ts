import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import { AssignmentGroup } from "../../assignment-group/entities/assignment-group.entity";
import { Priority } from "../../priority/entities/priority.entity";

@Entity("sla_matrix")
@Unique(["group", "priority"])
export class SlaMatrixEntry {
  @PrimaryGeneratedColumn({ name: "sla_matrix_id" }) slaMatrixId!: number;

  @ManyToOne(() => AssignmentGroup, { onDelete: "CASCADE", eager: true })
  @JoinColumn({ name: "group_id" }) group!: AssignmentGroup;

  @ManyToOne(() => Priority, { onDelete: "CASCADE", eager: true })
  @JoinColumn({ name: "priority_id" }) priority!: Priority;

  @Column({ name: "response_minutes" }) responseMinutes!: number;
  @Column({ name: "resolution_minutes" }) resolutionMinutes!: number;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
