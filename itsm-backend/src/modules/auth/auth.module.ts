import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { User } from "../users/entities/user.entity";
import { UserIdentity } from "./entities/user-identity.entity";
import { Role } from "../roles/entities/role.entity";
import { UserRole } from "../roles/entities/user-role.entity";
import { RolesModule } from "../roles/roles.module";
import { ItsmConfigModule } from "../itsm-config/itsm-config.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { LocalStrategy } from "./strategies/local.strategy";
import { SsoService } from "./sso.service";
import { SsoController } from "./sso.controller";
import { SocketAuthService } from "./socket-auth.service";
import { UserImpersonation } from "./entities/user-impersonation.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserIdentity, UserImpersonation, Role, UserRole]),
    RolesModule,
    ItsmConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("jwt.secret") as string,
        signOptions: {
          // e.g. "1d", "12h" - cast needed since @nestjs/jwt types this narrowly
          expiresIn: config.get<string>("jwt.expiresIn") as any,
        },
      }),
    }),
  ],
  controllers: [AuthController, SsoController],
  providers: [AuthService, JwtStrategy, LocalStrategy, SsoService, SocketAuthService],
  exports: [AuthService, JwtModule, SocketAuthService],
})
export class AuthModule {}
