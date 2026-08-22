import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { ChangesService } from "./changes.service";
import { CreateChangeDto, UpdateChangeDto } from "./dto/change.dto";

@ApiTags("changes") @ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("changes")
export class ChangesController {
  constructor(private readonly svc: ChangesService) {}
  @Post() @Roles("Admin", "Fulfiller", "Agent")
  create(@Body() dto: CreateChangeDto) { return this.svc.create(dto); }
  @Get() findAll() { return this.svc.findAll(); }
  @Get(":id") findOne(@Param("id", ParseIntPipe) id: number) { return this.svc.findOne(id); }
  @Patch(":id") @Roles("Admin", "Fulfiller", "Agent")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateChangeDto) { return this.svc.update(id, dto); }
  @Delete(":id") @Roles("Admin")
  remove(@Param("id", ParseIntPipe) id: number) { return this.svc.remove(id); }
}
