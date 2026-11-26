import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../users/entities/user.entity";
import { RolesService } from "../roles/roles.service";

export interface SocketUser {
  userId: number;
  username: string;
  roles: string[];
}

interface SocketJwtPayload {
  sub: number;
  username?: string;
}

@Injectable()
export class SocketAuthService {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly roles: RolesService,
  ) {}

  async authenticate(token?: string): Promise<SocketUser | null> {
    if (!token?.trim()) return null;

    let payload: SocketJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<SocketJwtPayload>(token);
    } catch (error) {
      if (error instanceof Error && ["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name)) return null;
      throw error;
    }

    if (!Number.isInteger(payload.sub) || payload.sub <= 0) return null;
    const user = await this.users.findOne({ where: { userId: payload.sub, isActive: true } });
    if (!user) return null;

    const roles = (await this.roles.getRoleNamesForUser(user.userId)).map((role) => {
      const normalized = role.trim().toLowerCase();
      return normalized === "admin" || normalized === "administrator" ? "Admin" : role.trim();
    });
    return { userId: user.userId, username: user.username, roles };
  }
}
