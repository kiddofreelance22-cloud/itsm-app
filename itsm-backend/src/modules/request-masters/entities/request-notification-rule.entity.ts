import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("request_notification_rules")
export class RequestNotificationRule {
  @PrimaryGeneratedColumn({ name: "rule_id" }) ruleId!: number;
  @Column({ name: "rule_name" }) ruleName!: string;
  @Column({ name: "event_key" }) eventKey!: string;
  @Column({ type: "text", array: true, default: () => "'{}'" }) recipients!: string[];
  @Column() subject!: string;
  @Column({ type: "text" }) body!: string;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @Column({ name: "display_order", default: 0 }) displayOrder!: number;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
