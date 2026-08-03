import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { User } from "./entities/user.entity";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { MailService } from "../mail/mail.service";
import { Role } from "../roles/entities/role.entity";
import { UserRole } from "../roles/entities/user-role.entity";
import * as crypto from "crypto";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Role) private rolesRepo: Repository<Role>,
    @InjectRepository(UserRole) private userRolesRepo: Repository<UserRole>,
    private mailService: MailService
  ) {}

  async create(dto: CreateUserDto): Promise<Omit<User, "passwordHash">> {
    const existing = await this.usersRepo.findOne({
      where: [{ username: dto.username }, { email: dto.email }],
    });
    if (existing) {
      throw new ConflictException("Username or email already in use");
    }

    const tempPassword = dto.password || crypto.randomBytes(6).toString("hex");
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = this.usersRepo.create({
      username: dto.username,
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      phone: dto.phone,
      isActive: dto.isActive ?? true,
      isTempPassword: true,
      tempPasswordCreatedAt: new Date(),
    });

    const saved = await this.usersRepo.save(user);

    const defaultRole = await this.rolesRepo.findOne({
      where: [{ roleCode: "ROLE_ENDUSER" }, { roleName: "End User" }],
    });

    if (defaultRole) {
      const userRole = this.userRolesRepo.create({
        user: saved,
        role: defaultRole,
      });
      await this.userRolesRepo.save(userRole);
    }

    // Fire-and-forget: don't fail user creation if SMTP is briefly down
    this.mailService
      .sendFirstTimeLoginEmail(saved.email, saved.fullName, tempPassword, saved.username)
      .catch(() => undefined);

    const { passwordHash: _, ...safeUser } = saved;
    return safeUser;
  }

  async findAll(): Promise<Omit<User, "passwordHash">[]> {
    const users = await this.usersRepo.find({
      order: { userId: "ASC" },
      relations: {
        userRoles: { role: true },
      },
    });
    return users.map(({ passwordHash, ...safe }) => safe);
  }

  async findOne(userId: number): Promise<Omit<User, "passwordHash">> {
    const user = await this.usersRepo.findOne({
      where: { userId },
      relations: {
        userRoles: { role: true },
      },
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async update(
    userId: number,
    dto: UpdateUserDto
  ): Promise<Omit<User, "passwordHash">> {
    const user = await this.usersRepo.findOne({ where: { userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (dto.username || dto.email) {
      const conflict = await this.usersRepo.findOne({
        where: [
          ...(dto.username ? [{ username: dto.username }] : []),
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      });
      if (conflict && conflict.userId !== userId) {
        throw new ConflictException("Username or email already in use");
      }
    }

    const { password, ...rest } = dto;
    Object.assign(user, rest);

    if (password) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }

    const saved = await this.usersRepo.save(user);
    const { passwordHash, ...safeUser } = saved;
    return safeUser;
  }

  async remove(userId: number): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    await this.usersRepo.remove(user);
  }

  async deactivate(userId: number): Promise<Omit<User, "passwordHash">> {
    return this.update(userId, { isActive: false });
  }
}
