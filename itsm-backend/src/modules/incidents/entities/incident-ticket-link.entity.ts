import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Column, Unique } from "typeorm";
import { Incident } from "./incident.entity";
import { User } from "../../users/entities/user.entity";

export type IncidentLinkTargetType = "request" | "incident" | "change" | "problem" | "work_order";

@Entity("incident_ticket_links")
@Unique("uq_incident_ticket_link_target", ["incident", "targetType", "targetRef"])
export class IncidentTicketLink {
  @PrimaryGeneratedColumn({ name: "link_id" }) linkId!: number;
  @ManyToOne(() => Incident, { onDelete: "CASCADE" })
  @JoinColumn({ name: "incident_id" }) incident!: Incident;
  @Column({ name: "target_type", type: "varchar", length: 20 }) targetType!: IncidentLinkTargetType;
  @Column({ name: "target_ref", type: "varchar", length: 60 }) targetRef!: string;
  @Column({ type: "varchar", length: 30, default: "Related to" }) relation!: string;
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" }) createdBy?: User | null;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
