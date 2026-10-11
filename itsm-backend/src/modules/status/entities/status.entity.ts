import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("statuses")
export class Status {
  @PrimaryGeneratedColumn({ name: "status_id" }) statusId!: number;
  @Column({ name: "status_name" }) statusName!: string;
  @Column({ name: "status_code", unique: true }) statusCode!: string;
  @Column({ default: "incident" }) type!: string;
  @Column({ type: "text", nullable: true }) description?: string | null;
  @Column({ name: "display_order", default: 0 }) displayOrder!: number;
  @Column({ default: 1 }) version!: number;
  @Column({ name: "is_open", default: true }) isOpen!: boolean;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
