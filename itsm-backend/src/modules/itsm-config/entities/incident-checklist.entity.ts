import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";


    @Entity("incident_checklists")
    export class IncidentChecklist {
      @PrimaryGeneratedColumn({ name: "id" }) id!: number;
      @Column() name!: string;
      @Column({ type: "text", nullable: true }) description?: string | null;
      @Column({ name: "display_order", default: 0 }) displayOrder!: number;
      @Column({ name: "is_active", default: true }) isActive!: boolean;
      /** Visibility scope: null = applies to everything. */
      @Column({ name: "group_id", type: "int", nullable: true }) groupId?: number | null;
      @Column({ name: "status_name", type: "varchar", nullable: true }) statusName?: string | null;
      @Column({ name: "category_id", type: "int", nullable: true }) categoryId?: number | null;
      @Column({ name: "include_sub_categories", default: false }) includeSubCategories!: boolean;
      @Column({ type: "jsonb", default: () => "'[]'" }) tasks!: { taskName: string; taskStatus: string; remarks: string; isActive: boolean }[];
      @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
      @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
    }
