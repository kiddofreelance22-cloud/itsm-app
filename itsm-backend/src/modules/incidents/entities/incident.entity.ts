import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { ServiceRequest } from "../../requests/entities/request.entity";
import { Category } from "../../categories/entities/category.entity";
import { User } from "../../users/entities/user.entity";

export type IncidentPriority = "Low" | "Medium" | "High" | "Critical";
export type IncidentStatus = "Open" | "In Progress" | "Resolved" | "Closed";

@Entity("incidents")
export class Incident {
  @PrimaryColumn({ type: "varchar", name: "incident_id" })
  incidentId: string;

  @ManyToOne(() => ServiceRequest, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "request_id" })
  request: ServiceRequest | null;

  @Column()
  title: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @ManyToOne(() => Category, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "category_id" })
  category: Category | null;

  @Column({ default: "Medium" })
  priority: IncidentPriority;

  @Column({ default: "Open" })
  status: IncidentStatus;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "assigned_to" })
  assignedTo: User | null;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by" })
  createdBy: User;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @Column({
    name: "resolved_at",
    type: "timestamp",
    nullable: true,
  })
  resolvedAt: Date | null;
}
