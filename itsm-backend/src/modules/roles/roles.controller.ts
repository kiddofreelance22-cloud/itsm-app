import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { RolesService } from "./roles.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { UpdateRolePermissionsDto } from "./dto/update-role-permissions.dto";
import { AssignRoleDto } from "./dto/assign-role.dto";

@ApiTags("roles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Roles("Administrator")
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Get()
  @Roles("Administrator")
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(":roleId")
  @Roles("Administrator")
  findOne(@Param("roleId", ParseIntPipe) roleId: number) {
    return this.rolesService.findOne(roleId);
  }

  @Patch(":roleId")
  @Roles("Administrator")
  update(
    @Param("roleId", ParseIntPipe) roleId: number,
    @Body() dto: UpdateRoleDto
  ) {
    return this.rolesService.update(roleId, dto);
  }

  @Delete(":roleId")
  @Roles("Administrator")
  remove(@Param("roleId", ParseIntPipe) roleId: number) {
    return this.rolesService.remove(roleId);
  }

  /** Get all permissions for a role */
  @Get(":roleId/permissions")
  @Roles("Administrator")
  getRolePermissions(@Param("roleId", ParseIntPipe) roleId: number) {
    return this.rolesService.getRolePermissions(roleId);
  }

  /** Users currently holding this role — powers the Users tab on the Edit Role panel */
  @Get(":roleId/users")
  @Roles("Administrator")
  getUsersForRole(@Param("roleId", ParseIntPipe) roleId: number) {
    return this.rolesService.getUsersForRole(roleId);
  }

  /** Update permissions for a role */
  @Put(":roleId/permissions")
  @Roles("Administrator")
  updateRolePermissions(
    @Param("roleId", ParseIntPipe) roleId: number,
    @Body() dto: UpdateRolePermissionsDto
  ) {
    return this.rolesService.updateRolePermissions(roleId, dto);
  }

  /** Get all available permissions */
  @Get("admin/all-permissions")
  @Roles("Administrator")
  getAllPermissions() {
    return this.rolesService.getAllPermissions();
  }

  /** Role Management screen: assign an existing role to an existing user */
  @Post("assign")
  @Roles("Administrator")
  assign(@Body() dto: AssignRoleDto) {
    return this.rolesService.assignRoleToUser(dto);
  }

  @Delete("user/:userId/role/:roleId")
  @Roles("Administrator")
  unassign(
    @Param("userId", ParseIntPipe) userId: number,
    @Param("roleId", ParseIntPipe) roleId: number
  ) {
    return this.rolesService.removeRoleFromUser(userId, roleId);
  }
}
