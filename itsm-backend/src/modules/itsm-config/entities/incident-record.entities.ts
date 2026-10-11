import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";

@Entity("incident_checklist_progress")
export class IncidentChecklistProgress {
  @PrimaryColumn({ name: "incident_id", type: "varchar" }) incidentId!: string;
  @PrimaryColumn({ name: "item_id" }) itemId!: number;
  @Column({ default: false }) done!: boolean;
  @Column({ name: "done_by", type: "int", nullable: true }) doneBy!: number | null;
  @Column({ name: "done_at", type: "timestamp", nullable: true }) doneAt!: Date | null;
}

@Entity("incident_links")
export class IncidentLink {
  @PrimaryGeneratedColumn({ name: "link_id" }) linkId!: number;
  @Column({ name: "incident_id", type: "varchar" }) incidentId!: string;
  @Column({ name: "linked_incident_id", type: "varchar" }) linkedIncidentId!: string;
  @Column({ name: "created_by", type: "int", nullable: true }) createdBy!: number | null;
  @Column({ name: "created_at", type: "timestamp", default: () => "now()" }) createdAt!: Date;
}

@Entity("role_navigation_access")
export class RoleNavigationAccess {
  @PrimaryColumn({ name: "role_id" }) roleId!: number;
  @PrimaryColumn({ name: "nav_key", type: "varchar" }) navKey!: string;
  @Column({ default: false }) visible!: boolean;
  @Column({ name: "can_create", default: false }) canCreate!: boolean;
}

@Entity("log_incident_fields")
export class LogIncidentField {
  @PrimaryColumn({ name: "field_key", type: "varchar" }) fieldKey!: string;
  @Column() name!: string;
  @Column() section!: string;
  @Column({ default: true }) visible!: boolean;
  @Column({ default: false }) required!: boolean;
  @Column({ name: "display_order", default: 0 }) displayOrder!: number;
}

@Entity("incident_attachments")
export class IncidentAttachment {
  @PrimaryGeneratedColumn({ name: "attachment_id" }) attachmentId!: number;
  @Column({ name: "incident_id", type: "varchar" }) incidentId!: string;
  @Column({ name: "file_name" }) fileName!: string;
  @Column({ name: "mime_type" }) mimeType!: string;
  @Column({ name: "size_bytes" }) sizeBytes!: number;
  @Column({ name: "storage_path", select: false }) storagePath!: string;
  @Column({ name: "uploaded_by", type: "int", nullable: true }) uploadedBy!: number | null;
  @Column({ name: "uploaded_at", type: "timestamp", default: () => "now()" }) uploadedAt!: Date;
}
