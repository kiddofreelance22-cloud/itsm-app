import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  UpdateDateColumn,
} from "typeorm";
import { RolePermission } from "./role-permission.entity";

@Entity("permissions")
export class Permission {
  @PrimaryGeneratedColumn({ name: "permission_id" })
  permissionId: number;

  @Column({ name: "module_name" })
  moduleName: string;

  @Column({ name: "permission_type" })
  permissionType: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @OneToMany(() => RolePermission, (rp) => rp.permission)
  rolePermissions: RolePermission[];
}
