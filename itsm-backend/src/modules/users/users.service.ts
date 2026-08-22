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

type SafeUser = Omit<User, "passwordHash">;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Role) private rolesRepo: Repository<Role>,
    @InjectRepository(UserRole) private userRolesRepo: Repository<UserRole>,
    @InjectRepository(AssignmentGroup) private groupsRepo: Repository<AssignmentGroup>,
    private mailService: MailService,
  ) {}

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const existing = await this.usersRepo.findOne({
      where: [{ username: dto.username }, { email: dto.email }],
    });
    if (existing) throw new ConflictException("Username or email already in use");

    const tempPassword = dto.password ?? crypto.randomBytes(6).toString("hex");
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Resolve related entities
    let primaryRole: Role | undefined;
    if (dto.roleId) {
      primaryRole = await this.rolesRepo.findOne({ where: { roleId: dto.roleId } }) ?? undefined;
    }

    let assignmentGroup: AssignmentGroup | undefined;
    if (dto.assignmentGroupId) {
      assignmentGroup = await this.groupsRepo.findOne({ where: { groupId: dto.assignmentGroupId } }) ?? undefined;
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
      department:           dto.department,
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

    const savedUser = await this.usersRepo.findOne({
      where: { userId: saved.userId },
      relations: { primaryRole: true, assignmentGroup: true },
    });
    if (!savedUser) {
      throw new NotFoundException(`User ${saved.userId} not found after create`);
    }

    const roleToAssign = primaryRole ?? await this.rolesRepo.findOne({
      where: [{ roleCode: "ROLE_ENDUSER" }, { roleName: "End User" }],
    });
    if (roleToAssign) {
      const userRole = this.userRolesRepo.create({ user: savedUser, role: roleToAssign });
      await this.userRolesRepo.save(userRole);
    }

    this.mailService
      .sendFirstTimeLoginEmail(savedUser.email, savedUser.fullName, tempPassword, savedUser.username)
      .catch((err) => console.error("Failed to send first-time login email", err));

    return this.findOne(savedUser.userId);
  }

  async findAll(): Promise<SafeUser[]> {
    const users = await this.usersRepo.find({
      order: { userId: "ASC" },
      relations: { userRoles: { role: true }, primaryRole: true, assignmentGroup: true },
    });
    return users.map(({ passwordHash, ...safe }) => safe);
  }

  async findOne(userId: number): Promise<SafeUser> {
    const user = await this.usersRepo.findOne({
      where: { userId },
      relations: { userRoles: { role: true }, primaryRole: true, assignmentGroup: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async update(userId: number, dto: UpdateUserDto): Promise<SafeUser> {
    const user = await this.usersRepo.findOne({
      where: { userId },
      relations: { primaryRole: true, assignmentGroup: true },
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
    if (dto.assignmentGroupId !== undefined) {
      user.assignmentGroup = dto.assignmentGroupId
        ? (await this.groupsRepo.findOne({ where: { groupId: dto.assignmentGroupId } }) ?? undefined)
        : undefined;
    }

    const { password, roleId, assignmentGroupId, ...rest } = dto;

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
}
