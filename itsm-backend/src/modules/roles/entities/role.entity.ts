import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { UserRole } from "./user-role.entity";
import { RolePermission } from "./role-permission.entity";

@Entity("roles")
export class Role {
  @PrimaryGeneratedColumn({ name: "role_id" })
  roleId: number;

  @Column({ name: "role_name", unique: true })
  roleName: string;

  @Column({ name: "role_code", unique: true, nullable: true })
  roleCode: string;

  @Column({ type: "jsonb", default: {} })
  permissions: Record<string, any>;

  @Column({ nullable: true })
  description: string;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @OneToMany(() => UserRole, (userRole) => userRole.role)
  userRoles: UserRole[];

  @OneToMany(() => RolePermission, (rp) => rp.role)
  rolePermissions: RolePermission[];
}
