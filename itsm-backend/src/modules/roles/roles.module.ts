import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Role } from "./entities/role.entity";
import { UserRole } from "./entities/user-role.entity";
import { Permission } from "./entities/permission.entity";
import { RolePermission } from "./entities/role-permission.entity";
import { User } from "../users/entities/user.entity";
import { RolesService } from "./roles.service";
import { RolesController } from "./roles.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Role, UserRole, User, Permission, RolePermission])],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService], // AuthModule needs this to read a user's roles at login
})
export class RolesModule {}
