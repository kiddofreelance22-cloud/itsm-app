import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { PriorityService } from "./priority.service";
import { CreatePriorityDto, UpdatePriorityDto } from "./dto/priority.dto";
@ApiTags("priority") @ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("priority")
export class PriorityController {
  constructor(private readonly svc: PriorityService) {}
  @Post() @Roles("Admin") create(@Body() dto: CreatePriorityDto) { return this.svc.create(dto); }
  @Get() findAll() { return this.svc.findAll(); }
  @Get(":id") findOne(@Param("id", ParseIntPipe) id: number) { return this.svc.findOne(id); }
  @Patch(":id") @Roles("Admin") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdatePriorityDto) { return this.svc.update(id, dto); }
  @Delete(":id") @Roles("Admin") remove(@Param("id", ParseIntPipe) id: number) { return this.svc.remove(id); }
}
