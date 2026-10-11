import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
export interface ServiceWindowDay { day: number; enabled: boolean; from: string; to: string; }
@Entity("sla_service_windows")
export class SlaServiceWindow {
  @PrimaryGeneratedColumn({ name: "sla_service_window_id" }) slaServiceWindowId!: number;
  @Column({ name: "sla_name", unique: true }) slaName!: string;
  @Column({ name: "holiday_calendar_location", nullable: true }) holidayCalendarLocation?: string;
  @Column({ name: "use_analyst_work_location", default: false }) useAnalystWorkLocation!: boolean;
  @Column({ type: "text", nullable: true }) description?: string | null;
  @Column({ name: "display_order", default: 0 }) displayOrder!: number;
  @Column({ name: "time_zone", default: "UTC" }) timeZone!: string;
  @Column({ name: "is_default", default: false }) isDefault!: boolean;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @Column({ name: "is_24_7", default: false }) is24x7!: boolean;
  @Column({ type: "jsonb", name: "service_window", default: "[]" }) serviceWindow!: ServiceWindowDay[];
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}