import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { User } from "../users/entities/user.entity";
import { RolesService } from "../roles/roles.service";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { DirectoryService } from "../itsm-config/directory.service";
import { UserImpersonation } from "./entities/user-impersonation.entity";
import { randomUUID } from "crypto";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(UserImpersonation) private impersonations: Repository<UserImpersonation>,
    private rolesService: RolesService,
    private jwtService: JwtService,
    private directory: DirectoryService,
  ) {}

  /** Called by LocalStrategy. Returns the user (without password hash) or null. */
  async validateUser(
    username: string,
    plainPassword: string
  ): Promise<Omit<User, "passwordHash"> | null> {
    const user = await this.usersRepo.findOne({ where: [{ username }, { email: username }] });
    if (!user || !user.isActive) {
      return null;
    }

    // Directory accounts never use the local hash (it is a random, unusable value).
    if (user.authType === "LDAP") {
      if (!(await this.directory.authenticateLdap(username, plainPassword))) return null;
      const { passwordHash, ...ldapSafe } = user;
      return ldapSafe;
    }
    if (await this.directory.isPasswordLoginBlocked(user)) {
      throw new UnauthorizedException("Your organisation requires you to sign in with Microsoft.");
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
    return roles.map((role) => {
      const normalized = role.trim().toLowerCase();
      return normalized === "admin" || normalized === "administrator" ? "Admin" : role.trim();
    });
  }

  async login(user: Omit<User, "passwordHash">): Promise<AuthResponseDto> {
    const rawRoles = await this.rolesService.getRoleNamesForUser(user.userId);
    const roles = this.normalizeRoles(rawRoles);

    // Get user permissions
    const permissions = await this.rolesService.getPermissionsForUser(user.userId);

    const payload = {
      sub: user.userId,
      username: user.username,
      roles,
      permissions,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        profilePhotoUrl: user.profilePhotoUrl,
        phone: user.phone,
        roles,
        permissions,
        isFirstLogin: (user as any).isTempPassword ?? false,
      },
    };
  }

  async switchUser(
    actor: { userId: number; roles: string[]; impersonatedBy?: unknown },
    targetUserId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    if (actor.impersonatedBy || !actor.roles.some((role) => ["admin", "administrator"].includes(role.trim().toLowerCase()))) {
      throw new ForbiddenException("Only a signed-in administrator can start a support session.");
    }
    const admin = await this.validateJwtUser(actor.userId);
    const target = await this.usersRepo.findOne({ where: { userId: targetUserId } });
    if (!target || !target.isActive) throw new NotFoundException("Active user not found.");
    if (target.userId === admin.userId) throw new ForbiddenException("You are already signed in as this user.");

    const roles = this.normalizeRoles(await this.rolesService.getRoleNamesForUser(target.userId));
    const permissions = await this.rolesService.getPermissionsForUser(target.userId);
    const sessionId = randomUUID();
    const actingAs = { userId: admin.userId, fullName: admin.fullName };
    await this.impersonations.save(this.impersonations.create({
      actorUserId: admin.userId,
      targetUserId: target.userId,
      sessionId,
      ipAddress: ipAddress?.slice(0, 64) ?? null,
      userAgent: userAgent?.slice(0, 500) ?? null,
      endedAt: null,
    }));

    const expiresAt = Date.now() + 1800 * 1000;
    return {
      impersonationId: sessionId,
      expiresAt,
      accessToken: this.jwtService.sign({
        sub: target.userId,
        username: target.username,
        roles,
        permissions,
        impersonatedBy: actingAs,
        impersonationId: sessionId,
      }, { expiresIn: 1800 }),
      user: {
        userId: target.userId,
        username: target.username,
        email: target.email,
        fullName: target.fullName,
        profilePhotoUrl: target.profilePhotoUrl,
        phone: target.phone,
        roles,
        permissions,
        impersonatedBy: actingAs,
      },
    };
  }

  async extendImpersonation(targetUserId: number, sessionId: string): Promise<AuthResponseDto & { expiresAt: number }> {
    const session = await this.impersonations.findOne({ where: { sessionId } });
    if (!session || session.targetUserId !== targetUserId || session.endedAt) {
      throw new ForbiddenException("The support session could not be verified.");
    }
    if (session.actorUserId === null) {
      throw new ForbiddenException("The original administrator session could not be verified.");
    }
    const target = await this.validateJwtUser(targetUserId);
    const roles = this.normalizeRoles(await this.rolesService.getRoleNamesForUser(target.userId));
    const permissions = await this.rolesService.getPermissionsForUser(target.userId);
    const actingAs = { userId: session.actorUserId, fullName: (await this.validateJwtUser(session.actorUserId)).fullName };
    const expiresAt = Date.now() + 1800 * 1000;
    return {
      impersonationId: sessionId,
      expiresAt,
      accessToken: this.jwtService.sign({
        sub: target.userId,
        username: target.username,
        roles,
        permissions,
        impersonatedBy: actingAs,
        impersonationId: sessionId,
      }, { expiresIn: 1800 }),
      user: {
        userId: target.userId,
        username: target.username,
        email: target.email,
        fullName: target.fullName,
        profilePhotoUrl: target.profilePhotoUrl,
        phone: target.phone,
        roles,
        permissions,
        impersonatedBy: actingAs,
      },
    };
  }

  async endImpersonation(actorUserId: number, sessionId: string): Promise<void> {
    const session = await this.impersonations.findOne({ where: { sessionId } });
    if (!session || session.actorUserId !== actorUserId) {
      throw new ForbiddenException("The support session could not be verified.");
    }
    if (!session.endedAt) {
      session.endedAt = new Date();
      await this.impersonations.save(session);
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
