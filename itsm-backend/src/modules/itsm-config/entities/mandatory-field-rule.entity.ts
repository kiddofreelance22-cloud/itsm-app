import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("mandatory_field_rules")
export class MandatoryFieldRule {
  @PrimaryGeneratedColumn({ name: "rule_id" }) ruleId!: number;
  @Column({ default: "" }) name!: string;
  @Column({ name: "condition_field" }) conditionField!: string;
  @Column({ name: "condition_values", type: "text", array: true, default: () => "'{}'" }) conditionValues!: string[];
  @Column({ name: "target_fields", type: "text", array: true, default: () => "'{}'" }) targetFields!: string[];
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @Column({ name: "display_order", default: 0 }) displayOrder!: number;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
