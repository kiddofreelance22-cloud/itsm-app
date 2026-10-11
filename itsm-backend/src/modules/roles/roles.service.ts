import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Role } from "./entities/role.entity";
import { UserRole } from "./entities/user-role.entity";
import { Permission } from "./entities/permission.entity";
import { RolePermission } from "./entities/role-permission.entity";
import { User } from "../users/entities/user.entity";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { UpdateRolePermissionsDto } from "./dto/update-role-permissions.dto";
import { AssignRoleDto } from "./dto/assign-role.dto";

// System roles required for the app's own RBAC checks (@Roles() decorators,
// JwtStrategy, seed data). Deleting these would lock admins out or break
// guards throughout the app, so they can't be removed from the UI/API.
const PROTECTED_ROLE_NAMES = ["Admin", "Administrator"];

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private rolesRepo: Repository<Role>,
    @InjectRepository(UserRole) private userRolesRepo: Repository<UserRole>,
    @InjectRepository(Permission) private permissionsRepo: Repository<Permission>,
    @InjectRepository(RolePermission) private rolePermissionsRepo: Repository<RolePermission>,
    @InjectRepository(User) private usersRepo: Repository<User>
  ) {}

  async create(dto: CreateRoleDto): Promise<Role> {
    const existing = await this.rolesRepo.findOne({
      where: { roleName: dto.roleName },
    });
    if (existing) {
      throw new ConflictException(`Role "${dto.roleName}" already exists`);
    }
    const role = this.rolesRepo.create(dto);
    return this.rolesRepo.save(role);
  }

  async findAll(): Promise<(Role & { userCount: number })[]> {
    const roles = await this.rolesRepo.find({
      relations: ["userRoles"],
      order: { roleId: "ASC" },
    });

    return roles.map((role) => ({
      ...role,
      userCount: role.userRoles ? role.userRoles.length : 0,
    }));
  }

  async findOne(roleId: number): Promise<Role> {
    const role = await this.rolesRepo.findOne({ where: { roleId } });
    if (!role) {
      throw new NotFoundException(`Role ${roleId} not found`);
    }
    return role;
  }

  async update(roleId: number, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(roleId);
    if (dto.roleName && dto.roleName.trim() !== role.roleName) {
      const conflict = await this.rolesRepo.findOne({ where: { roleName: dto.roleName.trim() } });
      if (conflict && conflict.roleId !== roleId) {
        throw new ConflictException(`Role "${dto.roleName}" already exists`);
      }
    }
    if (PROTECTED_ROLE_NAMES.includes(role.roleName) && dto.roleName && dto.roleName.trim() !== role.roleName) {
      throw new ForbiddenException(`"${role.roleName}" is a protected system role and cannot be renamed.`);
    }
    Object.assign(role, dto);
    return this.rolesRepo.save(role);
  }

  async remove(roleId: number): Promise<void> {
    const role = await this.findOne(roleId);
    if (PROTECTED_ROLE_NAMES.includes(role.roleName)) {
      throw new ForbiddenException(`"${role.roleName}" is a protected system role and cannot be deleted.`);
    }
    const assignedCount = await this.userRolesRepo.count({ where: { role: { roleId } } });
    if (assignedCount > 0) {
      throw new ConflictException(
        `Cannot delete "${role.roleName}" — it is still assigned to ${assignedCount} user(s). Reassign or remove those users first.`
      );
    }
    await this.rolesRepo.remove(role);
  }

  /** Get all permissions for a role */
  async getRolePermissions(roleId: number): Promise<{
    role: Role;
    permissions: Permission[];
    permissionSummary: Record<string, number>;
  }> {
    const role = await this.findOne(roleId);

    const rolePermissions = await this.rolePermissionsRepo.find({
      where: { roleId },
      relations: ["permission"],
    });

    const permissions = rolePermissions.map((rp) => rp.permission);

    // Calculate summary: count permissions by type
    const permissionSummary: Record<string, number> = {};
    const permissionTypes = ["Read", "Create", "Update", "Delete", "Admin"];

    for (const type of permissionTypes) {
      permissionSummary[type] = permissions.filter(
        (p) => p.permissionType === type
      ).length;
    }

    return { role, permissions, permissionSummary };
  }

  /** Update permissions for a role */
  async updateRolePermissions(
    roleId: number,
    dto: UpdateRolePermissionsDto
  ): Promise<{ role: Role; permissions: Permission[] }> {
    const role = await this.findOne(roleId);

    // Verify all permission IDs exist
    const permissions = await this.permissionsRepo.find({
      where: { permissionId: dto.permissionIds.length > 0 ? undefined : -1 },
    });

    if (dto.permissionIds.length > 0) {
      const foundPermissions = await this.permissionsRepo.find({
        where: dto.permissionIds.map((id) => ({ permissionId: id })),
      });

      if (foundPermissions.length !== dto.permissionIds.length) {
        throw new NotFoundException("Some permissions not found");
      }
    }

    // Delete existing permissions
    await this.rolePermissionsRepo.delete({ roleId });

    // Add new permissions
    for (const permissionId of dto.permissionIds) {
      const rolePermission = this.rolePermissionsRepo.create({
        roleId,
        permissionId,
      });
      await this.rolePermissionsRepo.save(rolePermission);
    }

    const updatedPermissions = await Promise.all(
      dto.permissionIds.map((id) => this.permissionsRepo.findOne({ where: { permissionId: id } }))
    );

    return { role, permissions: updatedPermissions.filter((p) => p !== null) };
  }

  /** Get all available permissions grouped by module */
  async getAllPermissions(): Promise<Record<string, Permission[]>> {
    const permissions = await this.permissionsRepo.find({
      where: { isActive: true },
      order: { moduleName: "ASC", permissionType: "ASC" },
    });

    const grouped: Record<string, Permission[]> = {};
    for (const perm of permissions) {
      if (!grouped[perm.moduleName]) {
        grouped[perm.moduleName] = [];
      }
      grouped[perm.moduleName].push(perm);
    }

    return grouped;
  }

  /** Assigns a role to a user (Role Management screen action). Idempotent-ish: rejects duplicates. */
  async assignRoleToUser(dto: AssignRoleDto): Promise<UserRole> {
    const user = await this.usersRepo.findOne({
      where: { userId: dto.userId },
      relations: { primaryRole: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${dto.userId} not found`);
    }

    const role = await this.findOne(dto.roleId);

    if (!user.primaryRole) {
      user.primaryRole = role;
      await this.usersRepo.save(user);
    }

    const existing = await this.userRolesRepo.findOne({
      where: { user: { userId: dto.userId }, role: { roleId: dto.roleId } },
    });

    // If the assignment already exists, return it (make this operation idempotent).
    // Previously this threw a 409 Conflict which caused clients to surface
    // an error when re-assigning the same role. Returning the existing
    // assignment lets UI flows that re-submit safely proceed.
    if (existing) {
      return existing;
    }

    const userRole = this.userRolesRepo.create({ user, role });
    return this.userRolesRepo.save(userRole);
  }

  async removeRoleFromUser(userId: number, roleId: number): Promise<void> {
    const userRole = await this.userRolesRepo.findOne({
      where: { user: { userId }, role: { roleId } },
    });
    if (!userRole) {
      throw new NotFoundException(
        `User ${userId} does not have role ${roleId}`
      );
    }
    await this.userRolesRepo.remove(userRole);
  }

  /** Used by AuthService to build the JWT payload's roles[] claim. */
  async getRoleNamesForUser(userId: number): Promise<string[]> {
    const userRoles = await this.userRolesRepo.find({
      where: { user: { userId } },
      relations: { role: true },
    });
    return userRoles.map((ur) => ur.role.roleName);
  }

  /** Get all permissions for a user (union of all their roles' permissions) */
  async getPermissionsForUser(userId: number): Promise<string[]> {
    const userRoles = await this.userRolesRepo.find({
      where: { user: { userId } },
      relations: { role: true },
    });

    const roleIds = userRoles.map((ur) => ur.role.roleId);
    
    if (roleIds.length === 0) return [];

    const rolePermissions = await this.rolePermissionsRepo.find({
      where: { roleId: In(roleIds) },
      relations: ["permission"],
    });

    // Return permissions in format "moduleName:permissionType" (e.g., "incidents:read")
    return rolePermissions.map((rp) => 
      `${rp.permission.moduleName.toLowerCase()}:${rp.permission.permissionType.toLowerCase()}`
    );
  }

  /** Users currently holding this role — powers the "Users" tab on the Edit Role panel. */
  async getUsersForRole(roleId: number): Promise<
    { userId: number; fullName: string; email: string; isActive: boolean }[]
  > {
    await this.findOne(roleId); // 404s if the role doesn't exist
    const userRoles = await this.userRolesRepo.find({
      relations: { user: true, role: true },
    });
    const assignedUsers = userRoles
      .filter((userRole) => userRole.role?.roleId === roleId)
      .sort((left, right) => left.user.fullName.localeCompare(right.user.fullName));
    return assignedUsers.map((ur) => ({
      userId: ur.user.userId,
      fullName: ur.user.fullName,
      email: ur.user.email,
      isActive: ur.user.isActive,
    }));
  }
}
