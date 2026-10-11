import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("workgroup_sla_windows")
export class WorkgroupSlaWindow {
  @PrimaryColumn({ name: "group_id" }) groupId!: number;
  @Column({ name: "sla_service_window_id", type: "int", nullable: true }) slaServiceWindowId!: number | null;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
