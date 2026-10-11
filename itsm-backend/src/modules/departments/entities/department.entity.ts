import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("departments")
export class Department {
  @PrimaryGeneratedColumn({ name: "department_id" })
  departmentId!: number;

  @Column({ name: "department_name" })
  departmentName!: string;

  @Column({ name: "department_code", unique: true })
  departmentCode!: string;

  @Column({ nullable: true })
  description!: string;

  @Column({ name: "is_active", default: true })
  isActive!: boolean;

  @Column({ name: "available_in_portal", default: true })
  availableInPortal!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
