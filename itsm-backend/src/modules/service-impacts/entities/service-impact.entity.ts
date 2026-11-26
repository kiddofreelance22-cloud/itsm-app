import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("service_impacts")
export class ServiceImpact {
  @PrimaryGeneratedColumn({ name: "service_impact_id" }) serviceImpactId!: number;
  @Column({ name: "impact_name", unique: true }) impactName!: string;
  @Column({ type: "text", nullable: true }) description?: string | null;
  @Column({ name: "sort_order", default: 0 }) sortOrder!: number;
  @Column({ name: "is_default", default: false }) isDefault!: boolean;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}