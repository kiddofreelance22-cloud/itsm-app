import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from "typeorm";
import { Incident } from "./incident.entity";
import { User } from "../../users/entities/user.entity";

export type ActivityType =
  | "comment"
  | "work_note"
  | "status_change"
  | "assignment_change"
  | "priority_change"
  | "sla_window_change"
  | "urgency_change"
  | "impact_change"
  | "claimed"
  | "released"
  | "group_assigned"
  | "created"
  | "resolved"
  | "closed"
  | "reopened"
  | "sla_breached";

@Entity("incident_activity")
export class IncidentActivity {
  @PrimaryGeneratedColumn({ name: "activity_id" }) activityId!: number;

  @ManyToOne(() => Incident, { onDelete: "CASCADE" })
  @JoinColumn({ name: "incident_id" }) incident!: Incident;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "actor_id" }) actor!: User;

  @Column({ default: "comment" }) type!: ActivityType;

  @Column({ type: "text", nullable: true }) content!: string;

  /** Extra structured data e.g. { from: "Open", to: "In Progress" } */
  @Column({ type: "jsonb", nullable: true }) meta!: Record<string, any>;

  @Column({ name: "is_work_note", default: false }) isWorkNote!: boolean;

  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
