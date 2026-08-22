import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

export type ChangeStatus = "Open" | "In Progress" | "Completed" | "Cancelled";

@Entity("changes")
export class Change {
  @PrimaryGeneratedColumn({ name: "change_id" }) changeId!: number;

  @Column({ name: "change_code", unique: true, nullable: true }) changeCode!: string;

  @Column({ name: "short_description" }) shortDescription!: string;

  @Column({ type: "text", nullable: true }) description!: string;

  @Column({ default: "Open" }) status!: ChangeStatus;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "assigned_to" }) assignedTo?: User;

  @Column({ name: "completed_at", nullable: true, type: "timestamp" }) completedAt?: Date;

  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
