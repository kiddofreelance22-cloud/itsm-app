import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";
@Entity("impacts")
export class Impact {
  @PrimaryGeneratedColumn({ name: "impact_id" }) impactId!: number;
  @Column({ name: "impact_name" }) impactName!: string;
  @Column({ name: "impact_code", unique: true }) impactCode!: string;
  @Column({ nullable: true }) description!: string;
  @Column({ name: "order", default: 0 }) order!: number;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
