import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { RequestConfigService } from "./request-config.service";
import {
  CreateRequestStatusDto, UpdateRequestStatusDto, CreateApproverGroupDto, UpdateApproverGroupDto,
  CreateRequestPriorityMatrixDto, UpdateRequestPriorityMatrixDto, CreateNotificationRuleDto, UpdateNotificationRuleDto,
} from "./request-config.dto";

@ApiTags("request-statuses") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("request-statuses")
export class RequestStatusesController {
  constructor(private s: RequestConfigService) {}
  @Get() list() { return this.s.listStatuses(); }
  @Get("stages") stages() { return this.s.stages(); }
  @Post() @Roles("Admin") create(@Body() dto: CreateRequestStatusDto) { return this.s.createStatus(dto); }
  @Patch(":id") @Roles("Admin") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateRequestStatusDto) { return this.s.updateStatus(id, dto); }
  @Delete(":id") @Roles("Admin") @HttpCode(204) remove(@Param("id", ParseIntPipe) id: number) { return this.s.removeStatus(id); }
}

@ApiTags("approver-groups") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("approver-groups")
export class ApproverGroupsController {
  constructor(private s: RequestConfigService) {}
  @Get() list() { return this.s.listGroups(); }
  @Get(":id") get(@Param("id", ParseIntPipe) id: number) { return this.s.getGroup(id); }
  @Post() @Roles("Admin") create(@Body() dto: CreateApproverGroupDto) { return this.s.createGroup(dto); }
  @Patch(":id") @Roles("Admin") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateApproverGroupDto) { return this.s.updateGroup(id, dto); }
  @Delete(":id") @Roles("Admin") @HttpCode(204) remove(@Param("id", ParseIntPipe) id: number) { return this.s.removeGroup(id); }
}

@ApiTags("request-priority-matrix") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("request-priority-matrix")
export class RequestPriorityMatrixController {
  constructor(private s: RequestConfigService) {}
  @Get() list() { return this.s.listMatrix(); }
  @Post() @Roles("Admin") create(@Body() dto: CreateRequestPriorityMatrixDto) { return this.s.createMatrix(dto); }
  @Patch(":id") @Roles("Admin") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateRequestPriorityMatrixDto) { return this.s.updateMatrix(id, dto); }
  @Delete(":id") @Roles("Admin") @HttpCode(204) remove(@Param("id", ParseIntPipe) id: number) { return this.s.removeMatrix(id); }
}

@ApiTags("request-notification-rules") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("request-notification-rules")
export class RequestNotificationRulesController {
  constructor(private s: RequestConfigService) {}
  @Get() @Roles("Admin") list() { return this.s.listRules(); }
  @Get("meta") @Roles("Admin") meta() { return this.s.notificationMeta(); }
  @Post() @Roles("Admin") create(@Body() dto: CreateNotificationRuleDto) { return this.s.createRule(dto); }
  @Patch(":id") @Roles("Admin") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateNotificationRuleDto) { return this.s.updateRule(id, dto); }
  @Delete(":id") @Roles("Admin") @HttpCode(204) remove(@Param("id", ParseIntPipe) id: number) { return this.s.removeRule(id); }
}
