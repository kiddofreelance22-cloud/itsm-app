import { Entity, PrimaryColumn, Column, UpdateDateColumn } from "typeorm";

/** One row per configuration section (models, risk, approval, …); `value` is the whole section as JSON. */
@Entity("change_settings")
export class ChangeSetting {
  @PrimaryColumn({ name: "setting_key" }) key!: string;
  @Column({ type: "jsonb" }) value!: unknown;
  @Column({ name: "updated_by", type: "int", nullable: true }) updatedBy?: number | null;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
