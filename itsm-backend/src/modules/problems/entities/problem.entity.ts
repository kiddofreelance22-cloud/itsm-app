import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

export type ProblemStatus = "Open" | "In Progress" | "Resolved" | "Closed";

@Entity("problems")
export class Problem {
  @PrimaryGeneratedColumn({ name: "problem_id" }) problemId!: number;

  @Column({ name: "problem_code", unique: true, nullable: true }) problemCode!: string;

  @Column({ name: "short_description" }) shortDescription!: string;

  @Column({ type: "text", nullable: true }) description!: string;

  @Column({ default: "Open" }) status!: ProblemStatus;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "assigned_to" }) assignedTo?: User;

  @Column({ name: "resolved_at", nullable: true, type: "timestamp" }) resolvedAt?: Date;

  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
