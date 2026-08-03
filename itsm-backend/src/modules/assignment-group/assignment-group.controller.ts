import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { AssignmentGroupService } from "./assignment-group.service";
import { CreateAssignmentGroupDto, UpdateAssignmentGroupDto } from "./dto/assignment-group.dto";

@ApiTags("assignment-groups") @ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("assignment-groups")
export class AssignmentGroupController {
  constructor(private readonly svc: AssignmentGroupService) {}
  @Post() @Roles("Admin") create(@Body() dto: CreateAssignmentGroupDto) { return this.svc.create(dto); }
  @Get() findAll() { return this.svc.findAll(); }
  @Get(":id") findOne(@Param("id", ParseIntPipe) id: number) { return this.svc.findOne(id); }
  @Patch(":id") @Roles("Admin") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateAssignmentGroupDto) { return this.svc.update(id, dto); }
  @Delete(":id") @Roles("Admin") remove(@Param("id", ParseIntPipe) id: number) { return this.svc.remove(id); }
}
