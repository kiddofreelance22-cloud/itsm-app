import { Controller, Get, Post, Body, Param, Patch, Delete, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { RequestsService } from "./requests.service";
import { RequestLinksService } from "./request-links.service";
import { PreviewPathDto } from "./dto/preview-path.dto";
import { AttachLinkDto, CreateRelatedDto, LinkCandidatesQueryDto, UpdateLinkDto, WorkNoteDto } from "./dto/request-links.dto";
import type { Actor } from "./requests.service";
import { CreateRequestDto } from "./dto/create-request.dto";
import { CreateAdminRequestDto } from "./dto/create-admin-request.dto";
import { CancelRequestDto } from "./dto/cancel-request.dto";
import { UpdateRequestDto } from "./dto/update-request.dto";
import {
  AssignRequestDto, HoldRequestDto, SubStatusDto, FulfilRequestDto, CloseRequestDto, ReopenRequestDto,
  RateRequestDto, ClassifyRequestDto, CommentRequestDto, ResubmitRequestDto, UpdateRequestTaskDto, RequestQueueQueryDto,
} from "./dto/request-lifecycle.dto";

@ApiTags("requests")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("requests")
export class RequestsController {
  constructor(private readonly requestsService: RequestsService, private readonly linksService: RequestLinksService) {}

  /** Request Submission screen action */
  @Post()
  create(@CurrentUser("userId") userId: number, @Body() dto: CreateRequestDto) {
    const { requestedForUserId, ...request } = dto;
    if (requestedForUserId && requestedForUserId !== userId) {
      this.requestsService.assertMayRequestForOthers();
      return this.requestsService.create(requestedForUserId, request, userId);
    }
    return this.requestsService.create(userId, request);
  }

  /** The route a request would take for these answers: which approvals apply and who fulfils it. Nothing is saved. */
  @Post("preview-path")
  previewPath(@Body() dto: PreviewPathDto) {
    return this.requestsService.previewPath(dto.catalogId, dto.variableValues ?? []);
  }

  @Post("admin")
  @Roles("Admin")
  createForUser(@CurrentUser("userId") adminUserId: number, @Body() dto: CreateAdminRequestDto) {
    const { requestedById, ...request } = dto;
    return this.requestsService.create(requestedById, request, adminUserId);
  }

  /** "My requests" list for the logged-in requester */
  @Get("mine")
  findMine(@CurrentUser("userId") userId: number) {
    return this.requestsService.findAllForUser(userId);
  }

  /** Service Request List: the fulfilment queue (filtered, paged, with status counts). */
  @Get("queue")
  @Roles("Admin", "Fulfiller")
  queue(@Query() query: RequestQueueQueryDto, @CurrentUser() user: Actor) {
    return this.requestsService.queue(query, user);
  }

  @Get()
  @Roles("Admin")
  findAll() {
    return this.requestsService.findAll();
  }

  /** Service Request Record */
  @Get(":requestId")
  findOne(@Param("requestId", ParseIntPipe) requestId: number, @CurrentUser() user: Actor) {
    return this.requestsService.findDetail(requestId, user);
  }

  @Patch(":requestId")
  @Roles("Admin")
  update(
    @Param("requestId", ParseIntPipe) requestId: number,
    @CurrentUser("userId") adminUserId: number,
    @Body() dto: UpdateRequestDto
  ) {
    return this.requestsService.update(requestId, adminUserId, dto);
  }

  // ── fulfilment agents ──
  @Post(":requestId/assign")
  @Roles("Admin", "Fulfiller")
  assign(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor, @Body() dto: AssignRequestDto) {
    return this.requestsService.assign(id, user, dto);
  }

  @Post(":requestId/start")
  @Roles("Admin", "Fulfiller")
  start(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor) {
    return this.requestsService.start(id, user);
  }

  @Post(":requestId/hold")
  @Roles("Admin", "Fulfiller")
  hold(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor, @Body() dto: HoldRequestDto) {
    return this.requestsService.hold(id, user, dto);
  }

  @Post(":requestId/resume")
  @Roles("Admin", "Fulfiller")
  resume(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor) {
    return this.requestsService.resume(id, user);
  }

  @Patch(":requestId/sub-status")
  @Roles("Admin", "Fulfiller")
  subStatus(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor, @Body() dto: SubStatusDto) {
    return this.requestsService.setSubStatus(id, user, dto.subStatus);
  }

  @Post(":requestId/fulfil")
  @Roles("Admin", "Fulfiller")
  fulfil(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor, @Body() dto: FulfilRequestDto) {
    return this.requestsService.fulfil(id, user, dto);
  }

  @Patch(":requestId/classification")
  @Roles("Admin", "Fulfiller")
  classify(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor, @Body() dto: ClassifyRequestDto) {
    return this.requestsService.classify(id, user, dto);
  }

  @Patch(":requestId/tasks/:taskId")
  @Roles("Admin", "Fulfiller")
  task(
    @Param("requestId", ParseIntPipe) id: number,
    @Param("taskId", ParseIntPipe) taskId: number,
    @CurrentUser() user: Actor,
    @Body() dto: UpdateRequestTaskDto
  ) {
    return this.requestsService.updateTask(id, taskId, user, dto.status);
  }

  // ── requester (agents may also close/reopen on their behalf) ──
  @Post(":requestId/close")
  close(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor, @Body() dto: CloseRequestDto) {
    return this.requestsService.close(id, user, dto.comments);
  }

  @Post(":requestId/reopen")
  reopen(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor, @Body() dto: ReopenRequestDto) {
    return this.requestsService.reopen(id, user, dto.comments);
  }

  @Post(":requestId/rate")
  rate(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor, @Body() dto: RateRequestDto) {
    return this.requestsService.rate(id, user, dto.rating, dto.comment);
  }

  @Post(":requestId/comments")
  comment(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor, @Body() dto: CommentRequestDto) {
    return this.requestsService.comment(id, user, dto.comments);
  }

  // ── Linked tickets and work notes (agents and admins) ──
  @Get(":requestId/links")
  listLinks(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor) { return this.linksService.list(id, user); }

  @Get(":requestId/links/candidates")
  linkCandidates(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor, @Query() q: LinkCandidatesQueryDto) { return this.linksService.candidates(id, user, q); }

  @Post(":requestId/links")
  attachLink(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor, @Body() dto: AttachLinkDto) { return this.linksService.attach(id, user, dto); }

  @Post(":requestId/links/create")
  createRelated(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor, @Body() dto: CreateRelatedDto) { return this.linksService.create(id, user, dto); }

  @Patch(":requestId/links/:linkId")
  updateLink(@Param("requestId", ParseIntPipe) id: number, @Param("linkId", ParseIntPipe) linkId: number, @CurrentUser() user: Actor, @Body() dto: UpdateLinkDto) { return this.linksService.updateRelation(id, linkId, user, dto.relation); }

  @Delete(":requestId/links/:linkId")
  async removeLink(@Param("requestId", ParseIntPipe) id: number, @Param("linkId", ParseIntPipe) linkId: number, @CurrentUser() user: Actor) { await this.linksService.remove(id, linkId, user); }

  @Get(":requestId/work-notes")
  listNotes(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor) { return this.linksService.listNotes(id, user); }

  @Post(":requestId/work-notes")
  addNote(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor, @Body() dto: WorkNoteDto) { return this.linksService.addNote(id, user, dto.text); }

  /** The requester answers a rejection that returned the request to them and sends it back into approval. */
  @Post(":requestId/resubmit")
  resubmit(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor, @Body() dto: ResubmitRequestDto) {
    return this.requestsService.resubmit(id, user, dto.comments);
  }

  /** Withdraw a request that has not started fulfilment (admins can cancel any open request). */
  @Post(":requestId/cancel")
  cancel(@Param("requestId", ParseIntPipe) id: number, @CurrentUser() user: Actor, @Body() dto: CancelRequestDto) {
    return this.requestsService.cancel(id, user, dto.comments);
  }
}
