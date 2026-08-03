import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";
@Entity("priorities")
export class Priority {
  @PrimaryGeneratedColumn({ name: "priority_id" }) priorityId: number;
  @Column({ name: "priority_name" }) priorityName: string;
  @Column({ name: "priority_code", unique: true }) priorityCode: string;
  @Column({ nullable: true }) description: string;
  @Column({ name: "order", default: 0 }) order: number;
  @Column({ name: "is_active", default: true }) isActive: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}
