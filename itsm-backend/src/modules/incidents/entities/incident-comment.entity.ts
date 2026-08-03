import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from "typeorm";
import { Incident } from "./incident.entity";
import { User } from "../../users/entities/user.entity";

@Entity("incident_comments")
export class IncidentComment {
  @PrimaryGeneratedColumn({ name: "comment_id" }) commentId!: number;

  @ManyToOne(() => Incident, { onDelete: "CASCADE" })
  @JoinColumn({ name: "incident_id" }) incident!: Incident;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "author_id" }) author!: User;

  @Column({ type: "text" }) content!: string;

  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
