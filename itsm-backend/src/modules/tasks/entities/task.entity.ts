import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Incident } from "../../incidents/entities/incident.entity";

export type TaskType = "Investigation" | "Implementation" | "Review" | "Approval" | "Other";
export type TaskStatus = "Open" | "In Progress" | "Completed" | "Cancelled";

@Entity("tasks")
export class Task {
  @PrimaryGeneratedColumn({ name: "task_id" }) taskId!: number;

  @Column({ name: "task_code", unique: true, nullable: true }) taskCode!: string;

  @Column({ name: "short_description" }) shortDescription!: string;

  @Column({ type: "text", nullable: true }) description!: string;

  @Column({ name: "task_type", default: "Investigation" }) taskType!: TaskType;

  @Column({ default: "Open" }) status!: TaskStatus;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "assigned_to" }) assignedTo?: User;

  @ManyToOne(() => Incident, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "incident_id" }) incident?: Incident;

  @Column({ name: "due_date", nullable: true }) dueDate?: Date;

  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
