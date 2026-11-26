import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateMyProfileDto, UpdateUserDto } from "./dto/update-user.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles("Admin")
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  // No @Roles — any authenticated user can search the directory. Backs the
  // "User Lookup" catalog variable on the requester-facing request form.
  // Registered before ":userId" so "directory" isn't swallowed by that
  // dynamic param route.
  @Get("directory")
  searchDirectory(@Query("q") q?: string) {
    return this.usersService.searchDirectory(q);
  }

  @Get("me")
  getMyProfile(@CurrentUser() user) {
    return this.usersService.findOne(user.userId);
  }

  @Patch("me")
  updateMyProfile(@CurrentUser() user, @Body() dto: UpdateMyProfileDto) {
    return this.usersService.updateMyProfile(user.userId, dto);
  }

  // Light-weight list (id, name, username) so analysts can pick an assignee for
  // work orders and tickets. The full /users list stays Admin-only because it
  // carries e-mail addresses and account details.
  @Get("assignable")
  @Roles("Admin", "Fulfiller")
  listAssignable() {
    return this.usersService.listAssignable();
  }

  @Get("switchable")
  @Roles("Admin")
  listSwitchable() {
    return this.usersService.listSwitchable();
  }

  @Get()
  @Roles("Admin")
  findAll() {
    return this.usersService.findAll();
  }

  @Get(":userId")
  @Roles("Admin")
  findOne(@Param("userId", ParseIntPipe) userId: number) {
    return this.usersService.findOne(userId);
  }

  @Patch(":userId")
  @Roles("Admin")
  update(
    @Param("userId", ParseIntPipe) userId: number,
    @Body() dto: UpdateUserDto
  ) {
    return this.usersService.update(userId, dto);
  }

  @Delete(":userId")
  @Roles("Admin")
  remove(@Param("userId", ParseIntPipe) userId: number) {
    return this.usersService.remove(userId);
  }

  @Patch(":userId/deactivate")
  @Roles("Admin")
  deactivate(@Param("userId", ParseIntPipe) userId: number) {
    return this.usersService.deactivate(userId);
  }
}
