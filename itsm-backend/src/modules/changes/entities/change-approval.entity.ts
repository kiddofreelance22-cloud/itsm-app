import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Change } from "./change.entity";

export type ApprovalStatus = "Pending" | "Approved" | "Rejected" | "Not required";

@Entity("change_approvals")
export class ChangeApproval {
  @PrimaryGeneratedColumn() id!: number;
  @ManyToOne(() => Change, (c) => c.approvals, { onDelete: "CASCADE" })
  @JoinColumn({ name: "change_id" }) change!: Change;
  @Column() stage!: number;
  @Column({ name: "approval_group" }) approvalGroup!: string;
  @Column({ nullable: true }) rule?: string;
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "approver_id" }) approver?: User;
  @Column({ default: "Pending" }) status!: ApprovalStatus;
  @Column({ type: "text", nullable: true }) comment?: string;
  @Column({ name: "meeting_id", type: "int", nullable: true }) meetingId?: number | null;
  @Column({ name: "decided_at", type: "timestamp", nullable: true }) decidedAt?: Date;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
