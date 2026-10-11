import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("notification_rules")
export class NotificationRule {
  @PrimaryGeneratedColumn({ name: "rule_id" }) ruleId!: number;
  @Column() name!: string;
  @Column({ name: "trigger_event" }) triggerEvent!: string;
  @Column({ type: "text", array: true, default: () => "'{}'" }) recipients!: string[];
  @Column() subject!: string;
  @Column({ type: "text", default: "" }) body!: string;
  /** "text" = plain text (line breaks kept); "html" = a designed e-mail whose HTML is sent as written. */
  @Column({ name: "body_format", type: "varchar", default: "text" }) bodyFormat!: "text" | "html";
  @Column({ name: "display_order", default: 0 }) displayOrder!: number;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
