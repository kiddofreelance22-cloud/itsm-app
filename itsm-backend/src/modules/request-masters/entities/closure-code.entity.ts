import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
@Entity("closure_codes")
export class ClosureCode {
  @PrimaryGeneratedColumn({ name: "closure_code_id" }) closureCodeId!: number;
  @Column({ name: "closure_code_name", unique: true }) closureCodeName!: string;
  @Column({ type: "text", nullable: true }) description?: string | null;
  @Column({ name: "display_order", default: 0 }) displayOrder!: number;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}