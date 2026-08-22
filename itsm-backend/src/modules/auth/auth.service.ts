import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { User } from "../users/entities/user.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { RolesService } from "../roles/roles.service";
import { AuthResponseDto } from "./dto/auth-response.dto";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(AssignmentGroup) private groupsRepo: Repository<AssignmentGroup>,
    private rolesService: RolesService,
    private jwtService: JwtService
  ) {}

  /** Called by LocalStrategy. Returns the user (without password hash) or null. */
  async validateUser(
    username: string,
    plainPassword: string
  ): Promise<Omit<User, "passwordHash"> | null> {
    const user = await this.usersRepo.findOne({ where: { username } });
    if (!user || !user.isActive) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(
      plainPassword,
      user.passwordHash
    );
    if (!passwordMatches) {
      return null;
    }

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  /** Called by AuthController after LocalAuthGuard confirms credentials. Issues the JWT. */
  private normalizeRoles(roles: string[]): string[] {
    return roles.map((role) => (role === "Administrator" ? "Admin" : role));
  }

  async login(user: Omit<User, "passwordHash">): Promise<AuthResponseDto> {
    const rawRoles = await this.rolesService.getRoleNamesForUser(user.userId);
    const roles = this.normalizeRoles(rawRoles);

    // Auto-join the default assignment group if the user is not in any group yet.
    // This lets newly created analysts access the group incident queue immediately
    // without an admin having to manually add them.
    await this.ensureDefaultGroupMembership(user.userId);

    const payload = {
      sub: user.userId,
      username: user.username,
      roles,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        roles,
        isFirstLogin: (user as any).isTempPassword ?? false,
      },
    };
  }

  /** If the user has no group memberships, silently add them to the default group. */
  private async ensureDefaultGroupMembership(userId: number): Promise<void> {
    try {
      const allGroups = await this.groupsRepo.find({ relations: { members: true } });
      const isMemberOfAny = allGroups.some((g) => g.members?.some((m) => m.userId === userId));
      if (isMemberOfAny) return;

      const defaultGroup = allGroups.find((g) => g.isDefault && g.isActive);
      if (!defaultGroup) return;

      const userEntity = await this.usersRepo.findOne({ where: { userId } });
      if (!userEntity) return;

      defaultGroup.members = [...(defaultGroup.members ?? []), userEntity];
      await this.groupsRepo.save(defaultGroup);
    } catch {
      // Non-fatal — don't block login if this fails
    }
  }

  /**
   * Validates the temporary password and replaces it with the new password.
   * Throws if the temp password is wrong or has expired (> 24 hours).
   */
  async resetTempPassword(
    email: string,
    tempPassword: string,
    newPassword: string,
  ): Promise<AuthResponseDto> {
    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isTempPassword) {
      throw new UnauthorizedException('No temporary password reset required');
    }
    // Check 24-hour expiry
    if (
      user.tempPasswordCreatedAt &&
      Date.now() - user.tempPasswordCreatedAt.getTime() > 24 * 60 * 60 * 1000
    ) {
      throw new UnauthorizedException(
        'Temporary password has expired. Please contact your administrator.',
      );
    }
    const valid = await bcrypt.compare(tempPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid temporary password');
    }
    // Update to the new permanent password
    user.passwordHash = await this.hashPassword(newPassword);
    user.isTempPassword = false;
    user.tempPasswordCreatedAt = undefined;
    await this.usersRepo.save(user);
    const { passwordHash, ...safeUser } = user;
    return this.login(safeUser);
  }

  /** Helper for a future /auth/register or admin "create user" flow. */
  async hashPassword(plainPassword: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(plainPassword, saltRounds);
  }

  async validateJwtUser(userId: number) {
    const user = await this.usersRepo.findOne({ where: { userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("User no longer active");
    }
    return user;
  }
}
