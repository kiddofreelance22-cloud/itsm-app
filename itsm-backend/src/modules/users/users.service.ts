import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { User } from "./entities/user.entity";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { MailService } from "../mail/mail.service";
import { Role } from "../roles/entities/role.entity";
import { UserRole } from "../roles/entities/user-role.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { Department } from "../departments/entities/department.entity";

type SafeUser = Omit<User, "passwordHash">;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Role) private rolesRepo: Repository<Role>,
    @InjectRepository(UserRole) private userRolesRepo: Repository<UserRole>,
    @InjectRepository(AssignmentGroup) private groupsRepo: Repository<AssignmentGroup>,
    @InjectRepository(Department) private departmentsRepo: Repository<Department>,
    private mailService: MailService,
  ) {}

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const existing = await this.usersRepo.findOne({
      where: [{ username: dto.username }, { email: dto.email }],
    });
    if (existing) throw new ConflictException("Username or email already in use");

    const tempPassword = dto.password ?? crypto.randomBytes(6).toString("hex");
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const defaultRole = await this.rolesRepo.findOne({
      where: [{ roleCode: "ROLE_ENDUSER" }, { roleName: "End User" }],
    });

    // Resolve related entities. New users should always have a primary role,
    // otherwise the DB role_id column remains NULL and the admin list loses
    // the real role context.
    let primaryRole: Role | undefined;
    if (dto.roleId) {
      primaryRole = await this.rolesRepo.findOne({ where: { roleId: dto.roleId } }) ?? undefined;
    }
    if (!primaryRole) {
      primaryRole = defaultRole ?? undefined;
    }

    let assignmentGroup: AssignmentGroup | undefined;
    if (dto.assignmentGroupId) {
      assignmentGroup = await this.groupsRepo.findOne({
        where: { groupId: dto.assignmentGroupId },
        relations: { members: true },
      }) ?? undefined;
    }

    let department: Department | undefined;
    if (dto.departmentId) {
      department = await this.departmentsRepo.findOne({
        where: { departmentId: dto.departmentId },
      }) ?? undefined;
    }

    const fullName = dto.displayName ?? `${dto.firstName} ${dto.lastName}`.trim();

    const user = this.usersRepo.create({
      username:             dto.username,
      email:                dto.email,
      passwordHash,
      firstName:            dto.firstName,
      lastName:             dto.lastName,
      fullName,
      displayName:          dto.displayName ?? fullName,
      phone:                dto.phone,
      workPhone:            dto.workPhone,
      mobilePhone:          dto.mobilePhone,
      alternateEmail:       dto.alternateEmail,
      employeeId:           dto.employeeId,
      jobTitle:             dto.jobTitle,
      department,
      departmentId:         department?.departmentId,
      managerName:          dto.managerName,
      businessService:      dto.businessService,
      location:             dto.location,
      costCenter:           dto.costCenter,
      building:             dto.building,
      floor:                dto.floor,
      deskNumber:           dto.deskNumber,
      userType:             dto.userType ?? "Internal",
      authType:             dto.authType ?? "Internal",
      ssoEnabled:           dto.ssoEnabled ?? false,
      isActive:             dto.isActive ?? true,
      allowMobileAccess:    dto.allowMobileAccess ?? true,
      allowApiAccess:       dto.allowApiAccess ?? false,
      allowLogin:           dto.allowLogin ?? true,
      reviewRequired:       dto.reviewRequired ?? false,
      passwordExpiryDays:   dto.passwordExpiryDays ?? 90,
      primaryRole,
      assignmentGroup,
      defaultLandingPage:   dto.defaultLandingPage ?? "My Dashboard",
      workAddress:          dto.workAddress,
      city:                 dto.city,
      state:                dto.state,
      country:              dto.country,
      postalCode:           dto.postalCode,
      emergencyContactName: dto.emergencyContactName,
      emergencyContactPhone: dto.emergencyContactPhone,
      emergencyContactRelation: dto.emergencyContactRelation,
      language:             dto.language ?? "English (US)",
      dateFormat:           dto.dateFormat ?? "DD MMM YYYY",
      timeZone:             dto.timeZone ?? "(GMT+05:30) Asia/Kolkata",
      notes:                dto.notes,
      isTempPassword:       !dto.password,
      tempPasswordCreatedAt: new Date(),
    });

    const saved = await this.usersRepo.save(user);

    // Setting a user's primary assignment group must also make them a
    // member of that group — otherwise the group's own "Members" list
    // (used by the Edit Assignment Group screen and workgroup counts)
    // never reflects users who were only ever set via their primary group.
    if (assignmentGroup && !assignmentGroup.members?.some((m) => m.userId === saved.userId)) {
      assignmentGroup.members = [...(assignmentGroup.members ?? []), saved];
      await this.groupsRepo.save(assignmentGroup);
    }

    const savedUser = await this.usersRepo.findOne({
      where: { userId: saved.userId },
      relations: { primaryRole: true, assignmentGroup: true, department: true },
    });
    if (!savedUser) {
      throw new NotFoundException(`User ${saved.userId} not found after create`);
    }

    const roleToAssign = primaryRole;
    if (roleToAssign) {
      const existingUserRole = await this.userRolesRepo.findOne({
        where: { user: { userId: savedUser.userId }, role: { roleId: roleToAssign.roleId } },
      });
      if (!existingUserRole) {
        const userRole = this.userRolesRepo.create({ user: savedUser, role: roleToAssign });
        await this.userRolesRepo.save(userRole);
      }
    }

    this.mailService
      .sendFirstTimeLoginEmail(savedUser.email, savedUser.fullName, tempPassword, savedUser.username)
      .catch((err) => console.error("Failed to send first-time login email", err));

    return this.findOne(savedUser.userId);
  }

  async findAll(): Promise<SafeUser[]> {
    const users = await this.usersRepo.find({
      order: { userId: "ASC" },
      relations: { userRoles: { role: true }, primaryRole: true, assignmentGroup: true, department: true },
    });
    return users.map(({ passwordHash, ...safe }) => ({
      ...safe,
      departmentId: safe.department?.departmentId ?? safe.departmentId,
    }));
  }

  async findOne(userId: number): Promise<SafeUser> {
    const user = await this.usersRepo.findOne({
      where: { userId },
      relations: { userRoles: { role: true }, primaryRole: true, assignmentGroup: true, department: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    const { passwordHash, ...safe } = user;
    return {
      ...safe,
      departmentId: user.department?.departmentId ?? user.departmentId,
    };
  }

  async update(userId: number, dto: UpdateUserDto): Promise<SafeUser> {
    const user = await this.usersRepo.findOne({
      where: { userId },
      relations: { primaryRole: true, assignmentGroup: true, department: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    if (dto.username || dto.email) {
      const conflict = await this.usersRepo.findOne({
        where: [
          ...(dto.username ? [{ username: dto.username }] : []),
          ...(dto.email    ? [{ email: dto.email }]       : []),
        ],
      });
      if (conflict && conflict.userId !== userId)
        throw new ConflictException("Username or email already in use");
    }

    if (dto.roleId !== undefined) {
      user.primaryRole = dto.roleId
        ? (await this.rolesRepo.findOne({ where: { roleId: dto.roleId } }) ?? undefined)
        : undefined;
    }
    if (dto.departmentId !== undefined) {
      if (dto.departmentId) {
        const department = await this.departmentsRepo.findOne({
          where: { departmentId: dto.departmentId },
        });
        if (!department) {
          throw new NotFoundException(`Department ${dto.departmentId} not found`);
        }
        user.department = department;
        user.departmentId = department.departmentId;
      } else {
        user.department = undefined;
        user.departmentId = undefined;
      }
    }
    const previousGroupId = user.assignmentGroup?.groupId;
    let newAssignmentGroup: AssignmentGroup | undefined;
    if (dto.assignmentGroupId !== undefined) {
      newAssignmentGroup = dto.assignmentGroupId
        ? (await this.groupsRepo.findOne({
            where: { groupId: dto.assignmentGroupId },
            relations: { members: true },
          }) ?? undefined)
        : undefined;
      user.assignmentGroup = newAssignmentGroup;
    }

    const { password, roleId, assignmentGroupId, departmentId, ...rest } = dto;

    // Recompute fullName if names changed
    const firstName = rest.firstName ?? user.firstName ?? "";
    const lastName  = rest.lastName  ?? user.lastName  ?? "";
    if (rest.firstName || rest.lastName) {
      user.fullName    = rest.displayName ?? `${firstName} ${lastName}`.trim();
      user.displayName = user.fullName;
    }

    Object.assign(user, rest);
    if (password) user.passwordHash = await bcrypt.hash(password, 10);

    await this.usersRepo.save(user);

    // Keep the new primary group's Members list in sync (mirrors the
    // same fix applied in create()) — and drop the user from the old
    // primary group's members if they moved to a different group.
    if (dto.assignmentGroupId !== undefined && previousGroupId !== dto.assignmentGroupId) {
      if (newAssignmentGroup && !newAssignmentGroup.members?.some((m) => m.userId === userId)) {
        newAssignmentGroup.members = [...(newAssignmentGroup.members ?? []), user];
        await this.groupsRepo.save(newAssignmentGroup);
      }
      if (previousGroupId) {
        const oldGroup = await this.groupsRepo.findOne({
          where: { groupId: previousGroupId },
          relations: { members: true },
        });
        if (oldGroup?.members?.some((m) => m.userId === userId)) {
          oldGroup.members = oldGroup.members.filter((m) => m.userId !== userId);
          await this.groupsRepo.save(oldGroup);
        }
      }
    }

    return this.findOne(userId);
  }

  async remove(userId: number): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    await this.usersRepo.remove(user);
  }

  async deactivate(userId: number): Promise<SafeUser> {
    return this.update(userId, { isActive: false });
  }

  /**
   * Minimal, safe directory lookup for any authenticated user — backs the
   * "User Lookup" catalog variable type on the requester-facing form, where
   * a non-admin requester needs to search for a colleague. Deliberately
   * returns only identifying fields, never the full admin user record
   * (no SSO settings, notes, employee metadata, etc.) and no password hash.
   */
  /** Caller lookup: matches first name, last name, full name, e-mail, employee ID and user name (every word must match something). */
  async searchDirectory(query?: string): Promise<{ userId: number; fullName: string; username: string; email: string; employeeId: string | null; phone: string | null; department?: string | null }[]> {
    const qb = this.usersRepo
      .createQueryBuilder("u")
      .select(["u.userId", "u.fullName", "u.username", "u.email", "u.firstName", "u.lastName", "u.employeeId", "u.phone"])
      .where("u.isActive = true")
      .orderBy("u.fullName", "ASC")
      .limit(25);

    const words = (query ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
    words.forEach((w, i) => {
      qb.andWhere(
        `(u.firstName ILIKE :w${i} OR u.lastName ILIKE :w${i} OR u.fullName ILIKE :w${i} OR u.email ILIKE :w${i} OR u.employeeId ILIKE :w${i} OR u.username ILIKE :w${i})`,
        { [`w${i}`]: `%${w}%` },
      );
    });

    const users = await qb.getMany();
    return users.map((u) => ({ userId: u.userId, fullName: u.fullName, username: u.username, email: u.email, employeeId: u.employeeId ?? null, phone: u.phone ?? null }));
  }
}
