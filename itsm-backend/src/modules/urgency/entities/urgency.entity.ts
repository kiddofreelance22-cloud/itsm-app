import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";
@Entity("urgencies")
export class Urgency {
  @PrimaryGeneratedColumn({ name: "urgency_id" }) urgencyId!: number;
  @Column({ name: "urgency_name" }) urgencyName!: string;
  @Column({ name: "urgency_code", unique: true }) urgencyCode!: string;
  @Column({ nullable: true }) description!: string;
  @Column({ name: "order", default: 0 }) order!: number;
  @Column({ type: "varchar", length: 20, nullable: true }) color?: string | null;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
