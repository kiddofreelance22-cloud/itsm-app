import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

export interface JwtPayload {
  sub: number; // userId
  username: string;
  roles: string[];
  exp?: number;
  impersonatedBy?: { userId: number; fullName: string };
  impersonationId?: string;
}

/**
 * Validates the Bearer token on every request guarded by JwtAuthGuard.
 * Whatever validate() returns becomes request.user (used by @CurrentUser() and RolesGuard).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("jwt.secret") as string,
    });
  }

  async validate(payload: JwtPayload) {
    // Payload was already verified (signature + expiry) by passport-jwt at this point.
    return {
      userId: payload.sub,
      username: payload.username,
      roles: payload.roles,
      impersonatedBy: payload.impersonatedBy,
      impersonationId: payload.impersonationId,
      expiresAt: payload.exp ? payload.exp * 1000 : undefined,
    };
  }
}
