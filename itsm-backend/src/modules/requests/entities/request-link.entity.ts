import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Unique } from "typeorm";
import { ServiceRequest } from "./request.entity";
import { User } from "../../users/entities/user.entity";

export type LinkTargetType = "request" | "incident" | "change" | "problem" | "work_order";

/** A ticket of any type linked from a service request. target_ref is that ticket's number (e.g. INC…, CHG…, WO-…). */
@Entity("request_links")
@Unique("uq_request_link_target", ["request", "targetType", "targetRef"])
export class RequestLink {
  @PrimaryGeneratedColumn({ name: "link_id" }) linkId!: number;
  @ManyToOne(() => ServiceRequest, { onDelete: "CASCADE" }) @JoinColumn({ name: "request_id" }) request!: ServiceRequest;
  @Column({ name: "target_type", type: "varchar", length: 20 }) targetType!: LinkTargetType;
  @Column({ name: "target_ref", type: "varchar", length: 60 }) targetRef!: string;
  @Column({ type: "varchar", length: 30, default: "Related to" }) relation!: string;
  @Column({ type: "varchar", length: 300, nullable: true }) title?: string | null;
  @Column({ type: "varchar", length: 300, nullable: true }) details?: string | null;
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" }) @JoinColumn({ name: "created_by" }) createdBy?: User | null;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
