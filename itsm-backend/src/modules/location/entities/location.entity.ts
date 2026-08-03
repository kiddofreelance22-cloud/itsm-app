import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("locations")
export class Location {
  @PrimaryGeneratedColumn({ name: "location_id" }) locationId: number;
  @Column({ name: "location_name" }) locationName: string;
  @Column({ name: "location_code", unique: true }) locationCode: string;
  @Column({ default: "Office" }) type: string;
  @Column({ nullable: true }) description: string;
  @Column({ name: "is_active", default: true }) isActive: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}
