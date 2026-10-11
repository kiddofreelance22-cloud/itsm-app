import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";


    @Entity("incident_wo_checklist_items")
    export class WoChecklistItem {
      @PrimaryGeneratedColumn({ name: "id" }) id!: number;
      @Column() name!: string;
      @Column({ type: "text", nullable: true }) description?: string | null;
      @Column({ name: "display_order", default: 0 }) displayOrder!: number;
      @Column({ name: "is_required", default: false }) isRequired!: boolean;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
      @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
      @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
    }
