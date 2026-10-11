import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";


    @Entity("resolution_codes")
    export class ResolutionCode {
      @PrimaryGeneratedColumn({ name: "id" }) id!: number;
      @Column() name!: string;
      @Column({ type: "text", nullable: true }) description?: string | null;
      @Column({ name: "display_order", default: 0 }) displayOrder!: number;
      @Column({ name: "is_active", default: true }) isActive!: boolean;
      @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
      @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
    }
