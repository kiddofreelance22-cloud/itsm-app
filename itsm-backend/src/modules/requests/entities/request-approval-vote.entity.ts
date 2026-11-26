import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Unique } from "typeorm";
import { RequestApproval } from "./request-approval.entity";
import { User } from "../../users/entities/user.entity";

/** One answer from a distinct user on an approval level; slot ids are based on user ids ("u:12"). */
@Entity("request_approval_votes")
@Unique("uq_approval_vote_slot", ["approval", "slot"])
export class RequestApprovalVote {
  @PrimaryGeneratedColumn({ name: "vote_id" }) voteId!: number;
  @ManyToOne(() => RequestApproval, { onDelete: "CASCADE" }) @JoinColumn({ name: "request_approval_id" }) approval!: RequestApproval;
  @Column({ type: "varchar", length: 40 }) slot!: string;
  @ManyToOne(() => User, { onDelete: "CASCADE" }) @JoinColumn({ name: "user_id" }) user!: User;
  @Column({ type: "varchar", length: 10 }) decision!: "Pending" | "Approved" | "Rejected" | "Cancelled";
  @Column({ type: "text", nullable: true }) comments?: string | null;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
