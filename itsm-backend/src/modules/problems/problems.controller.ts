import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { ProblemsService } from "./problems.service";
import { CreateProblemDto, UpdateProblemDto } from "./dto/problem.dto";

@ApiTags("problems") @ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("problems")
export class ProblemsController {
  constructor(private readonly svc: ProblemsService) {}
  @Post() @Roles("Admin", "Fulfiller", "Agent")
  create(@Body() dto: CreateProblemDto) { return this.svc.create(dto); }
  @Get() findAll() { return this.svc.findAll(); }
  @Get(":id") findOne(@Param("id", ParseIntPipe) id: number) { return this.svc.findOne(id); }
  @Patch(":id") @Roles("Admin", "Fulfiller", "Agent")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateProblemDto) { return this.svc.update(id, dto); }
  @Delete(":id") @Roles("Admin")
  remove(@Param("id", ParseIntPipe) id: number) { return this.svc.remove(id); }
}
