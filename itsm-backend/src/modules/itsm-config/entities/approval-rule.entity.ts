import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("approval_rules")
export class ApprovalRule {
  @PrimaryGeneratedColumn({ name: "rule_id" }) ruleId!: number;
  @Column({ default: "" }) name!: string;
  @Column() action!: "Resolve" | "Close" | "Reopen";
  @Column({ name: "approval_type" }) approvalType!: string;
  @Column({ name: "condition_field", default: "Any Incident" }) conditionField!: string;
  @Column({ name: "condition_values", type: "text", array: true, default: () => "'{}'" }) conditionValues!: string[];
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @Column({ name: "display_order", default: 0 }) displayOrder!: number;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
