import {
  Controller,
  Get,
  Post,
  Patch,
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
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

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
