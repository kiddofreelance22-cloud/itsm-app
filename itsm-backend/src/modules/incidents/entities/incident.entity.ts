import {
  Entity, PrimaryColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from "typeorm";
import { ServiceRequest } from "../../requests/entities/request.entity";
import { Category } from "../../categories/entities/category.entity";
import { SubCategory } from "../../sub-category/entities/sub-category.entity";
import { User } from "../../users/entities/user.entity";
import { AssignmentGroup } from "../../assignment-group/entities/assignment-group.entity";
import { Location } from "../../location/entities/location.entity";

export type IncidentPriority = "Low" | "Medium" | "High" | "Critical";
export type IncidentStatus = "Open" | "Assigned" | "In Progress" | "On Hold" | "Resolved" | "Closed";
export type IncidentImpact = "Low" | "Medium" | "High";
export type IncidentUrgency = "Low" | "Medium" | "High";

@Entity("incidents")
export class Incident {
  @PrimaryColumn({ type: "varchar", name: "incident_id" }) incidentId!: string;

  @Column({ name: "incident_code", unique: true, nullable: true })
  incidentCode!: string;

  @ManyToOne(() => ServiceRequest, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "request_id" }) request?: ServiceRequest;

  @Column() title!: string;
  @Column({ type: "text", nullable: true }) description?: string;

  @ManyToOne(() => Category, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "category_id" }) category?: Category;

  @ManyToOne(() => SubCategory, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "sub_category_id" }) subCategory?: SubCategory;

  @Column({ default: "Medium" }) priority!: IncidentPriority;
  @Column({ default: "Medium" }) impact!: IncidentImpact;
  @Column({ default: "Medium" }) urgency!: IncidentUrgency;
  @Column({ default: "Open" }) status!: IncidentStatus;

  @ManyToOne(() => AssignmentGroup, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "group_id" }) assignmentGroup?: AssignmentGroup;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "assigned_to" }) assignedTo?: User;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by" }) createdBy!: User;

  @ManyToOne(() => Location, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "location_id" }) location?: Location;

  @Column({ name: "affected_asset", nullable: true }) affectedAsset?: string;
  @Column({ name: "business_service", nullable: true }) businessService?: string;
  @Column({ name: "contact_number", nullable: true }) contactNumber?: string;
  @Column({ nullable: true }) department?: string;

  @Column({ name: "sla_response_target", nullable: true, type: "timestamp" }) slaResponseTarget?: Date;
  @Column({ name: "sla_resolution_target", nullable: true, type: "timestamp" }) slaResolutionTarget?: Date;
  @Column({ name: "sla_response_met", default: false }) slaResponseMet!: boolean;
  @Column({ name: "sla_breached", default: false }) slaBreached!: boolean;

  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
  @Column({ name: "resolved_at", nullable: true, type: "timestamp" }) resolvedAt?: Date;
  @Column({ name: "claimed_at", nullable: true, type: "timestamp" }) claimedAt?: Date;
}
