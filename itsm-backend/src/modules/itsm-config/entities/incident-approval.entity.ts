import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Incident } from "../../incidents/entities/incident.entity";
import { User } from "../../users/entities/user.entity";

export type IncidentApprovalStatus = "Pending" | "Approved" | "Rejected";

@Entity("incident_approvals")
export class IncidentApproval {
  @PrimaryGeneratedColumn({ name: "approval_id" }) approvalId!: number;

  @ManyToOne(() => Incident, { onDelete: "CASCADE", eager: true })
  @JoinColumn({ name: "incident_id" }) incident!: Incident;

  @Column({ name: "approval_type" }) approvalType!: string;
  @Column() action!: "Resolve" | "Close" | "Reopen";
  @Column({ default: "Pending" }) status!: IncidentApprovalStatus;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL", eager: true })
  @JoinColumn({ name: "requested_by" }) requestedBy?: User | null;
  @Column({ name: "request_comments", type: "text", nullable: true }) requestComments?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "approver_id" }) approver?: User | null;
  @Column({ name: "approver_note", type: "text", nullable: true }) approverNote?: string | null;

  @Column({ name: "requested_at", type: "timestamp", default: () => "now()" }) requestedAt!: Date;
  @Column({ name: "decided_at", type: "timestamp", nullable: true }) decidedAt?: Date | null;
  /** Set once an Approved request has been used to let the gated action through. */
  @Column({ name: "consumed_at", type: "timestamp", nullable: true }) consumedAt?: Date | null;
}
