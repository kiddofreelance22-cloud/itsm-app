import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity("form_templates")
export class FormTemplate {
  @PrimaryGeneratedColumn({ name: "form_template_id" })
  formTemplateId!: number;

  @Column({ name: "name", type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string;

  @Column({ name: "template_type", type: "varchar", length: 20 })
  templateType!: string; // group, form

  @Column({ name: "template_data", type: "jsonb" })
  templateData!: Record<string, unknown>;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by_id" })
  createdBy?: User;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
