import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Change } from "./change.entity";

export type ChangeTaskState = "Open" | "In Progress" | "Closed" | "Cancelled";

@Entity("change_tasks")
export class ChangeTask {
  @PrimaryGeneratedColumn() id!: number;
  @ManyToOne(() => Change, (c) => c.tasks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "change_id" }) change!: Change;
  @Column({ name: "task_code" }) taskCode!: string;
  @Column({ name: "short_description" }) shortDescription!: string;
  @Column({ name: "assignment_group", nullable: true }) assignmentGroup?: string;
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "assigned_to" }) assignedTo?: User;
  @Column({ default: "Open" }) state!: ChangeTaskState;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
