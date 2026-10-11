import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { AssignmentGroupService } from "./assignment-group.service";
import { CreateAssignmentGroupDto, UpdateAssignmentGroupDto } from "./dto/assignment-group.dto";

@ApiTags("assignment-groups") @ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("assignment-groups")
export class AssignmentGroupController {
  constructor(private readonly svc: AssignmentGroupService) {}
  @Post() @Roles("Admin") create(@Body() dto: CreateAssignmentGroupDto) { return this.svc.create(dto); }
  /** Admins see every group; everyone else only sees the groups they belong to (so Hardware Support staff don't see other teams). */
  @Get() findAll(@CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[]) { return this.svc.findAllVisibleTo(userId, roles ?? []); }
  /** Must be declared before ":id" so it isn't swallowed by the numeric route. */
  @Get("my-workgroups")
  getMyWorkgroups(@CurrentUser("userId") userId: number) { return this.svc.getMyWorkgroups(userId); }
  @Get(":id") findOne(@Param("id", ParseIntPipe) id: number) { return this.svc.findOne(id); }
  @Patch(":id") @Roles("Admin") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateAssignmentGroupDto) { return this.svc.update(id, dto); }
  @Delete(":id") @Roles("Admin") remove(@Param("id", ParseIntPipe) id: number) { return this.svc.remove(id); }
  @Post(":id/members/:userId") @Roles("Admin") addMember(@Param("id", ParseIntPipe) id: number, @Param("userId", ParseIntPipe) userId: number) { return this.svc.addMember(id, userId); }
  @Delete(":id/members/:userId") @Roles("Admin") removeMember(@Param("id", ParseIntPipe) id: number, @Param("userId", ParseIntPipe) userId: number) { return this.svc.removeMember(id, userId); }
  @Get(":id/open-tickets/:userId") getOpenTicketsCount(@Param("id", ParseIntPipe) id: number, @Param("userId", ParseIntPipe) userId: number) { return this.svc.countOpenTickets(id, userId); }
}
