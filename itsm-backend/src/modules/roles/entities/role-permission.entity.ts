import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Role } from "./role.entity";
import { Permission } from "./permission.entity";

@Entity("role_permissions")
export class RolePermission {
  @PrimaryGeneratedColumn({ name: "role_permission_id" })
  rolePermissionId: number;

  @ManyToOne(() => Role, (role) => role.rolePermissions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "role_id" })
  role: Role;

  @Column({ name: "role_id" })
  roleId: number;

  @ManyToOne(() => Permission, (perm) => perm.rolePermissions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "permission_id" })
  permission: Permission;

  @Column({ name: "permission_id" })
  permissionId: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
