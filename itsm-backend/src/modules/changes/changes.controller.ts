import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { ChangesService, isAdminActor } from "./changes.service";
import type { Actor } from "./changes.service";
import { CabService } from "./cab.service";
import { ChangeConfigService } from "./change-config.service";
import { COND_FIELDS, IMPACTS, IMPLEMENTATION_OUTCOMES, NOTIFICATION_FIELDS, NOTIFICATION_TRIGGERS, RECIPIENT_KINDS, SERVICES, URGENCIES } from "./change-config";
import {
  ApprovalDecisionDto, CabAttendanceDto, CabDecisionDto, ChangeListQueryDto, CloseChangeDto, CompleteImplementationDto, CreateChangeDto,
  CreateChangeTaskDto, EndMeetingDto, PreviewChangeDto, RequestInfoDto, SavePirDto, SimulateDto, UpdateChangeDto, UpdateChangeTaskDto, WorkNoteDto,
} from "./dto/change.dto";

@ApiTags("changes") @ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("changes")
export class ChangesController {
  constructor(private readonly svc: ChangesService, private readonly cab: CabService, private readonly settings: ChangeConfigService) {}

  // Any signed-in user may raise a change; staff-only actions are enforced in the service.
  @Post() create(@Body() dto: CreateChangeDto, @CurrentUser() u: Actor) { return this.svc.create(dto, u); }
  @Get() findAll(@Query() q: ChangeListQueryDto, @CurrentUser() u: Actor) { return this.svc.findAll(q, u); }

  // Static routes must come before ":id".
  @Get("config") async config(@CurrentUser() u: Actor) {
    const config = await this.settings.effective();
    if (!isAdminActor(u)) {
      config.lifecycles = config.lifecycles.map((lifecycle) => ({
        ...lifecycle,
        steps: lifecycle.steps.map((step) => {
          const visible = { ...step };
          delete visible.integrationUrl;
          return visible;
        }),
      }));
    }
    return { ...config, outcomes: IMPLEMENTATION_OUTCOMES, impacts: IMPACTS, urgencies: URGENCIES, services: SERVICES, recipientKinds: RECIPIENT_KINDS, notificationFields: NOTIFICATION_FIELDS, notificationTriggers: NOTIFICATION_TRIGGERS, condFields: COND_FIELDS };
  }
  /** Save one configuration section (models, categories, closeCodes, risk, templates, approval, windows, lifecycles, notifications). Admin only. */
  @Put("config/:key") async saveConfig(@Param("key") key: string, @Body() body: unknown, @CurrentUser() u: Actor) {
    if (!isAdminActor(u)) throw new ForbiddenException("Only an administrator can change Change Management settings.");
    return this.settings.save(key, body, u.userId);
  }
  @Post("config/simulate") async simulate(@Body() dto: SimulateDto, @CurrentUser() u: Actor) {
    const result = await this.svc.simulate(dto.changeType, dto.risk, dto.category, dto.attrs, dto.lifecycleId);
    if (isAdminActor(u)) return result;
    return {
      ...result,
      steps: result.steps.map((step) => {
        const visible = { ...step };
        delete visible.integrationUrl;
        return visible;
      }),
    };
  }
  /** Active workgroups (Configuration → Workgroup): the only list of assignment groups a change may use. Open to every signed-in user raising a change. */
  @Get("workgroups") workgroups() { return this.svc.workgroups(); }
  @Get("overview") overview(@CurrentUser() u: Actor) { return this.svc.overview(u); }
  @Post("preview") preview(@Body() dto: PreviewChangeDto) { return this.svc.preview(dto); }
  @Get("schedule") schedule(@Query("from") from: string, @Query("to") to: string, @CurrentUser() u: Actor) { return this.svc.schedule(from, to, u); }

  @Get("cab/workbench") workbench(@CurrentUser() u: Actor) { return this.cab.workbench(u); }
  @Post("cab/meetings/:id/start") startMeeting(@Param("id", ParseIntPipe) id: number, @CurrentUser() u: Actor) { return this.cab.start(id, u); }
  @Post("cab/meetings/:id/attendance") attendance(@Param("id", ParseIntPipe) id: number, @Body() dto: CabAttendanceDto, @CurrentUser() u: Actor) { return this.cab.setAttendance(id, dto.attendance, u); }
  @Post("cab/meetings/:id/end") endMeeting(@Param("id", ParseIntPipe) id: number, @Body() dto: EndMeetingDto, @CurrentUser() u: Actor) { return this.cab.end(id, dto.minutes, u); }
  @Post("cab/meetings/:id/decisions") cabDecision(@Param("id", ParseIntPipe) id: number, @Body() dto: CabDecisionDto, @CurrentUser() u: Actor) { return this.cab.decide(id, dto, u); }

  @Get("approvals/mine") myApprovals(@CurrentUser() u: Actor) { return this.svc.myApprovals(u); }
  @Get("approvals/blocked") blockedApprovals(@CurrentUser() u: Actor) { return this.svc.blockedApprovals(u); }
  @Post("approvals/:approvalId/decision")
  decide(@Param("approvalId", ParseIntPipe) id: number, @Body() dto: ApprovalDecisionDto, @CurrentUser() u: Actor) { return this.svc.decide(id, dto, u); }

  @Get(":id") findOne(@Param("id", ParseIntPipe) id: number, @CurrentUser() u: Actor) { return this.svc.detail(id, u); }
  @Patch(":id") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateChangeDto, @CurrentUser() u: Actor) { return this.svc.update(id, dto, u); }
  @Delete(":id") @Roles("Admin") remove(@Param("id", ParseIntPipe) id: number) { return this.svc.remove(id); }

  @Post(":id/submit") submit(@Param("id", ParseIntPipe) id: number, @CurrentUser() u: Actor) { return this.svc.submit(id, u); }
  @Post(":id/request-info") requestInfo(@Param("id", ParseIntPipe) id: number, @Body() dto: RequestInfoDto, @CurrentUser() u: Actor) { return this.svc.requestInfo(id, dto.comment, u); }
  @Post(":id/implementation/start") start(@Param("id", ParseIntPipe) id: number, @CurrentUser() u: Actor) { return this.svc.startImplementation(id, u); }
  @Post(":id/implementation/complete")
  complete(@Param("id", ParseIntPipe) id: number, @Body() dto: CompleteImplementationDto, @CurrentUser() u: Actor) { return this.svc.completeImplementation(id, dto, u); }
  @Post(":id/pir") pir(@Param("id", ParseIntPipe) id: number, @Body() dto: SavePirDto, @CurrentUser() u: Actor) { return this.svc.savePir(id, dto, u); }
  @Post(":id/close") close(@Param("id", ParseIntPipe) id: number, @Body() dto: CloseChangeDto, @CurrentUser() u: Actor) { return this.svc.close(id, dto, u); }
  @Post(":id/cancel") cancel(@Param("id", ParseIntPipe) id: number, @Body() dto: { reason?: string }, @CurrentUser() u: Actor) { return this.svc.cancel(id, dto?.reason, u); }

  @Post(":id/tasks") addTask(@Param("id", ParseIntPipe) id: number, @Body() dto: CreateChangeTaskDto, @CurrentUser() u: Actor) { return this.svc.addTask(id, dto, u); }
  @Patch(":id/tasks/:taskId")
  updateTask(@Param("id", ParseIntPipe) id: number, @Param("taskId", ParseIntPipe) taskId: number, @Body() dto: UpdateChangeTaskDto, @CurrentUser() u: Actor) { return this.svc.updateTask(id, taskId, dto, u); }
  @Post(":id/notes") async note(@Param("id", ParseIntPipe) id: number, @Body() dto: WorkNoteDto, @CurrentUser() u: Actor) {
    await this.svc.findOneFor(id, u);   // same visibility rule as reading the change
    await this.svc.addNote(id, dto.note, u);
    return this.svc.findOneFor(id, u);
  }
}
