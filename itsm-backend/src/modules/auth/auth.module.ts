import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { User } from "../users/entities/user.entity";
import { RolesModule } from "../roles/roles.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { LocalStrategy } from "./strategies/local.strategy";
import { SsoService } from "./sso.service";
import { SsoController } from "./sso.controller";
import { ItsmConfigModule } from "../itsm-config/itsm-config.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
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
  providers: [AuthService, JwtStrategy, LocalStrategy, SsoService],
  exports: [AuthService],
})
export class AuthModule {}
