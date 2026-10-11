import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { IncidentsService } from "./incidents.service";
import { IncidentsGateway } from "./incidents.gateway";
import { CreateIncidentDto } from "./dto/create-incident.dto";
import { AdminIncidentQueryDto } from "./dto/admin-incident-query.dto";
import { UpdateIncidentDto } from "./dto/update-incident.dto";
import { AssignGroupDto } from "./dto/assign-group.dto";

class CreateCommentDto {
  @IsString() @IsNotEmpty() content!: string;
  @IsOptional() @Transform(({ value }) => value === "true" || value === true) @IsBoolean() isWorkNote?: boolean;
}

class ResolveIncidentDto {
  @IsString() @IsNotEmpty() resolutionCode!: string;
  @IsString() @IsNotEmpty() resolutionNotes!: string;
  @IsOptional() @IsString() additionalComments?: string;
  @IsOptional() @IsString() resolutionCategory?: string;
  @IsOptional() @IsString() resolutionSubcategory?: string;
  @IsOptional() @IsString() closureCode?: string;
  @IsOptional() @IsString() impact?: string;
  @IsOptional() @IsString() urgency?: string;
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional() @IsString() knowledgeArticle?: string;
}

@ApiTags("incidents") @ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("incidents")
export class IncidentsController {
  constructor(
    private readonly svc: IncidentsService,
    private readonly gateway: IncidentsGateway,
  ) {}

  @Post()
  async create(
    @CurrentUser("userId") userId: number,
    @CurrentUser("roles") roles: string[],
    @Body() dto: CreateIncidentDto,
  ) {
    const incident = await this.svc.create(userId, dto, roles ?? []);
    this.gateway.emitIncidentCreated(incident.assignmentGroup?.groupId, incident);
    return incident;
  }

  @Get("mine")
  findMine(@CurrentUser("userId") userId: number) { return this.svc.findAllForUser(userId); }

  @Get("assigned-to-me")
  findAssignedToMe(@CurrentUser("userId") userId: number) { return this.svc.findAssignedToUser(userId); }

  /** All incidents belonging to any group the current user is a member of.
   *  Accessible to Engineers, Service Desk, and any other authenticated role. */
  @Get("workgroup")
  findWorkgroup(@CurrentUser("userId") userId: number) { return this.svc.findForWorkgroup(userId); }

  @Get("admin-list")
  @Roles("Admin")
  findAdminList(@Query() query: AdminIncidentQueryDto) {
    return this.svc.findAdminList(query);
  }

  @Get("queue/:groupId")
  getGroupQueue(
    @Param("groupId", ParseIntPipe) groupId: number,
    @CurrentUser("userId") userId: number,
    @CurrentUser("roles") roles: string[],
  ) {
    return this.svc.getGroupQueue(groupId, userId, roles ?? []);
  }

  @Get()
  @Roles("Admin", "Fulfiller")
  findAll(
    @CurrentUser("userId") userId: number,
    @CurrentUser("roles") roles: string[],
    @Query("assignmentGroupId") assignmentGroupId?: string,
    @Query("assignedToUserId") assignedToUserId?: string,
    @Query("openOnly") openOnly?: string,
  ) {
    if (assignmentGroupId || assignedToUserId) {
      return this.svc.findFiltered({
        groupId: assignmentGroupId ? Number(assignmentGroupId) : undefined,
        assignedToUserId: assignedToUserId ? Number(assignedToUserId) : undefined,
        openOnly: openOnly === "true",
      });
    }
    return roles?.some((role) => ["Admin", "Administrator"].includes(role))
      ? this.svc.findAll()
      : this.svc.findForWorkgroup(userId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[]) { return this.svc.assertCanAccess(id, userId, roles ?? []); }

  @Post(":id/claim")
  @HttpCode(HttpStatus.OK)
  async claimIncident(
    @Param("id") id: string,
    @CurrentUser("userId") userId: number,
    @CurrentUser("roles") roles: string[],
  ) {
    const incident = await this.svc.claimIncident(id, userId, roles ?? []);
    this.gateway.emitIncidentClaimed(id, incident.assignmentGroup?.groupId, incident);
    return incident;
  }

  @Post(":id/release")
  @HttpCode(HttpStatus.OK)
  async releaseIncident(
    @Param("id") id: string,
    @CurrentUser("userId") userId: number,
    @CurrentUser("roles") roles: string[],
  ) {
    const incident = await this.svc.releaseIncident(id, userId, roles ?? []);
    this.gateway.emitIncidentReleased(id, incident.assignmentGroup?.groupId, incident);
    return incident;
  }

  @Patch(":id/assignment-group")
  @Roles("Admin", "Fulfiller")
  async assignGroup(
    @Param("id") id: string,
    @CurrentUser("userId") userId: number,
    @Body() dto: AssignGroupDto,
  ) {
    const incident = await this.svc.assignGroup(id, dto.assignmentGroupId, userId);
    this.gateway.emitIncidentUpdated(id, incident);
    return incident;
  }

  @Post(":id/resolve")
  @Roles("Admin", "Fulfiller")
  @HttpCode(HttpStatus.OK)
  async resolve(
    @Param("id") id: string,
    @CurrentUser("userId") userId: number,
    @Body() dto: ResolveIncidentDto,
  ) {
    const incident = await this.svc.update(id, { status: "Resolved", resolutionNotes: dto.resolutionNotes, resolutionCode: dto.resolutionCode }, userId);
    await this.svc.addComment(
      id, userId,
      `Resolved: ${dto.resolutionNotes}${dto.additionalComments ? "\n\n" + dto.additionalComments : ""}`,
      true,
    );
    this.gateway.emitIncidentUpdated(id, incident);
    return incident;
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateIncidentDto,
    @CurrentUser("userId") userId: number,
    @CurrentUser("roles") roles: string[],
  ) {
    const incident = await this.svc.update(id, dto, userId, roles ?? []);
    this.gateway.emitIncidentUpdated(id, incident);
    return incident;
  }

  @Delete(":id")
  @Roles("Admin")
  remove(@Param("id") id: string) { return this.svc.remove(id); }

  @Get(":id/activity")
  getActivity(@Param("id") id: string, @CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[]) { return this.svc.getActivity(id, { userId, roles: roles ?? [] }); }

  @Get(":id/activities")
  getActivities(@Param("id") id: string, @CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[]) { return this.svc.getActivity(id, { userId, roles: roles ?? [] }); }

  @Post(":id/activity")
  async addActivity(
    @Param("id") id: string,
    @CurrentUser("userId") userId: number,
    @CurrentUser("roles") roles: string[],
    @Body() dto: CreateCommentDto,
  ) {
    const activity = await this.svc.addComment(id, userId, dto.content, dto.isWorkNote, roles ?? []);
    this.gateway.emitActivityAdded(id, activity);
    return activity;
  }

  @Post(":id/activities")
  async addActivities(
    @Param("id") id: string,
    @CurrentUser("userId") userId: number,
    @CurrentUser("roles") roles: string[],
    @Body() dto: CreateCommentDto,
  ) {
    const activity = await this.svc.addComment(id, userId, dto.content, dto.isWorkNote, roles ?? []);
    this.gateway.emitActivityAdded(id, activity);
    return activity;
  }

  @Get(":id/comments")
  getComments(@Param("id") id: string, @CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[]) { return this.svc.getActivity(id, { userId, roles: roles ?? [] }); }

  @Post(":id/comments")
  async addComment(
    @Param("id") id: string,
    @CurrentUser("userId") userId: number,
    @CurrentUser("roles") roles: string[],
    @Body() dto: CreateCommentDto,
  ) {
    const activity = await this.svc.addComment(id, userId, dto.content, false, roles ?? []);
    this.gateway.emitActivityAdded(id, activity);
    return activity;
  }
}
