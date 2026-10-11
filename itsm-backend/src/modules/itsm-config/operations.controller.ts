import {
  BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, UseGuards, Delete,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { ApprovalDecisionDto, ModerateFeedbackDto, RequestApprovalDto, UpdateWorkOrderDto, WorkOrderDto } from "./dto/itsm-config.dto";
import { IncidentApproval } from "./entities/incident-approval.entity";
import { WorkOrder } from "./entities/work-order.entity";
import { Incident } from "../incidents/entities/incident.entity";
import { User } from "../users/entities/user.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { NotificationService } from "./notification.service";

const APPROVER_ROLES = ["Admin", "Administrator", "IT Manager"];
const isApprover = (roles: string[] = []) => roles.some((r) => APPROVER_ROLES.includes(r));
const isFulfiller = (roles: string[] = []) => roles.some((r) => ["Admin", "Administrator", "Fulfiller", "IT Agent", "IT Manager", "Service Desk", "Engineer", "Agent"].includes(r));

const approvalRow = (a: IncidentApproval) => ({
  approvalId: a.approvalId,
  incidentId: a.incident?.incidentId,
  incidentRef: a.incident?.incidentCode ?? a.incident?.incidentId,
  shortDescription: a.incident?.title ?? "",
  approvalType: a.approvalType,
  action: a.action,
  status: a.status,
  requestedBy: a.requestedBy?.fullName ?? "—",
  requestedAt: a.requestedAt,
  requestComments: a.requestComments ?? "",
  approverNote: a.approverNote ?? "",
  decidedAt: a.decidedAt ?? null,
});

// ───────────────────────── Approve Incident Records ─────────────────────────
@ApiTags("incident-approvals") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("incident-approvals")
export class IncidentApprovalsController {
  constructor(
    @InjectRepository(IncidentApproval) private repo: Repository<IncidentApproval>,
    @InjectRepository(Incident) private incidents: Repository<Incident>,
    private notify: NotificationService,
  ) {}

  /** Approvers see every request; everyone else sees only the requests they raised. */
  @Get()
  async list(@CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[], @Query("pending") pending?: string) {
    const qb = this.repo.createQueryBuilder("a")
      .leftJoinAndSelect("a.incident", "incident").leftJoinAndSelect("a.requestedBy", "requestedBy")
      .orderBy("a.requestedAt", "DESC");
    if (!isApprover(roles)) qb.where("requestedBy.userId = :userId", { userId });
    if (pending === "true") qb.andWhere("a.status = 'Pending'");
    return (await qb.getMany()).map(approvalRow);
  }

  /** Manual request (the usual path is automatic, via the Approval Configuration rules). */
  @Post()
  async request(@CurrentUser("userId") userId: number, @Body() dto: RequestApprovalDto) {
    const incident = await this.incidents.findOne({ where: { incidentId: dto.incidentId }, relations: { createdBy: true, assignedTo: true, assignmentGroup: true } });
    if (!incident) throw new NotFoundException("Incident not found");
    const type = dto.action === "Close" ? "Closure Approval" : dto.action === "Reopen" ? "Reopen Approval" : "Change Approval";
    const saved = await this.repo.save(this.repo.create({
      incident, approvalType: type, action: dto.action, status: "Pending",
      requestedBy: { userId } as User, requestComments: dto.comments ?? null,
    }));
    await this.notify.dispatch("approvalRequested", incident);
    return approvalRow(await this.repo.findOneOrFail({ where: { approvalId: saved.approvalId } }));
  }

  @Post(":id/approve") @Roles("Admin", "IT Manager")
  approve(@Param("id", ParseIntPipe) id: number, @CurrentUser("userId") userId: number, @Body() dto: ApprovalDecisionDto) {
    return this.decide(id, userId, "Approved", dto.note);
  }

  @Post(":id/reject") @Roles("Admin", "IT Manager")
  reject(@Param("id", ParseIntPipe) id: number, @CurrentUser("userId") userId: number, @Body() dto: ApprovalDecisionDto) {
    return this.decide(id, userId, "Rejected", dto.note);
  }

  private async decide(id: number, userId: number, status: "Approved" | "Rejected", note?: string) {
    const a = await this.repo.findOne({ where: { approvalId: id } });
    if (!a) throw new NotFoundException("Approval request not found");
    if (a.status !== "Pending") throw new BadRequestException(`This request was already ${a.status.toLowerCase()}.`);
    if (a.requestedBy?.userId === userId) throw new ForbiddenException("You cannot decide a request you raised yourself.");
    a.status = status;
    a.approver = { userId } as User;
    a.approverNote = note?.trim() || null;
    a.decidedAt = new Date();
    await this.repo.save(a);
    return approvalRow(await this.repo.findOneOrFail({ where: { approvalId: id } }));
  }
}

// ───────────────────────── Feedback moderation ─────────────────────────
@ApiTags("feedback-moderation") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("feedback-moderation")
export class FeedbackModerationController {
  constructor(@InjectRepository(Incident) private incidents: Repository<Incident>) {}

  private row(i: Incident) {
    return {
      incidentId: i.incidentId,
      incidentRef: i.incidentCode ?? i.incidentId,
      submittedBy: i.createdBy?.fullName ?? "—",
      date: i.feedbackSubmittedAt ?? i.closedAt ?? i.updatedAt,
      rating: i.feedbackRating ?? 0,
      comment: i.feedbackComment ?? "",
      published: i.feedbackPublished,
      flagged: i.feedbackFlagged,
      moderatorNote: i.feedbackModeratorNote ?? "",
      moderated: !!i.feedbackModeratedAt,
    };
  }

  /** Fulfillers/Admins see all feedback; a requester sees only their own (read-only). */
  @Get()
  async list(@CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[], @Query("pending") pending?: string) {
    const qb = this.incidents.createQueryBuilder("i").leftJoinAndSelect("i.createdBy", "createdBy")
      .where("i.feedbackRating IS NOT NULL").orderBy("i.feedbackSubmittedAt", "DESC", "NULLS LAST");
    if (!isFulfiller(roles)) qb.andWhere("createdBy.userId = :userId", { userId });
    if (pending === "true") qb.andWhere("i.feedbackModeratedAt IS NULL");
    return (await qb.getMany()).map((i) => this.row(i));
  }

  @Patch(":incidentId") @Roles("Admin", "Fulfiller")
  async moderate(@Param("incidentId") incidentId: string, @CurrentUser("userId") userId: number, @Body() dto: ModerateFeedbackDto) {
    const i = await this.incidents.findOne({ where: { incidentId }, relations: { createdBy: true } });
    if (!i || i.feedbackRating == null) throw new NotFoundException("No feedback on this incident");
    if (dto.published !== undefined) i.feedbackPublished = dto.published;
    if (dto.flagged !== undefined) i.feedbackFlagged = dto.flagged;
    if (dto.note !== undefined) i.feedbackModeratorNote = dto.note.trim() || null;
    i.feedbackModeratedBy = userId;
    i.feedbackModeratedAt = new Date();
    return this.row(await this.incidents.save(i));
  }
}

// ───────────────────────── Work orders ─────────────────────────
@ApiTags("work-orders") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("work-orders")
export class WorkOrdersController {
  constructor(
    @InjectRepository(WorkOrder) private repo: Repository<WorkOrder>,
    @InjectRepository(Incident) private incidents: Repository<Incident>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(AssignmentGroup) private groups: Repository<AssignmentGroup>,
  ) {}

  private row(w: WorkOrder) {
    return {
      workOrderId: w.workOrderId, woNumber: w.woNumber, title: w.title, notes: w.notes ?? "",
      incidentId: w.incident?.incidentId ?? null, incidentRef: w.incident?.incidentCode ?? w.incident?.incidentId ?? null,
      groupId: w.group?.groupId ?? null, workgroup: w.group?.groupName ?? "—",
      assignedToId: w.assignedTo?.userId ?? null, assignedTo: w.assignedTo?.fullName ?? "Unassigned",
      priority: w.priority, status: w.status, isActive: w.isActive, createdAt: w.createdAt,
    };
  }

  @Get() @Roles("Admin", "Fulfiller")
  async list(@Query("q") q?: string, @Query("incidentId") incidentId?: string) {
    const qb = this.repo.createQueryBuilder("w")
      .leftJoinAndSelect("w.incident", "incident").leftJoinAndSelect("w.group", "grp").leftJoinAndSelect("w.assignedTo", "assignee")
      .orderBy("w.workOrderId", "DESC");
    if (incidentId) qb.andWhere("incident.incidentId = :incidentId", { incidentId });
    if (q?.trim()) {
      qb.andWhere(new Brackets((b) => b
        .where("w.title ILIKE :q", { q: `%${q.trim()}%` }).orWhere("w.woNumber ILIKE :q", { q: `%${q.trim()}%` })
        .orWhere("incident.incidentCode ILIKE :q", { q: `%${q.trim()}%` })));
    }
    return (await qb.getMany()).map((w) => this.row(w));
  }

  @Post() @Roles("Admin", "Fulfiller")
  async create(@CurrentUser("userId") userId: number, @Body() dto: WorkOrderDto) {
    const w = this.repo.create({
      title: dto.title.trim(), notes: dto.notes ?? null, priority: dto.priority ?? "P3 - Medium",
      status: (dto.status as any) ?? "Open", isActive: dto.isActive ?? true, createdBy: { userId } as User,
    });
    await this.applyRefs(w, dto);
    const saved = await this.repo.save(w);
    // woNumber is a DB default → re-read.
    return this.row(await this.repo.findOneOrFail({ where: { workOrderId: saved.workOrderId } }));
  }

  @Patch(":id") @Roles("Admin", "Fulfiller")
  async update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateWorkOrderDto) {
    const w = await this.repo.findOne({ where: { workOrderId: id } });
    if (!w) throw new NotFoundException("Work order not found");
    if (dto.title !== undefined) w.title = dto.title.trim();
    if (dto.notes !== undefined) w.notes = dto.notes;
    if (dto.priority !== undefined) w.priority = dto.priority;
    if (dto.status !== undefined) w.status = dto.status as any;
    if (dto.isActive !== undefined) w.isActive = dto.isActive;
    await this.applyRefs(w, dto);
    await this.repo.save(w);
    return this.row(await this.repo.findOneOrFail({ where: { workOrderId: id } }));
  }

  @Delete(":id") @Roles("Admin", "Fulfiller")
  async remove(@Param("id", ParseIntPipe) id: number) {
    const w = await this.repo.findOne({ where: { workOrderId: id } });
    if (!w) throw new NotFoundException("Work order not found");
    await this.repo.remove(w);
    return { deleted: true };
  }

  private async applyRefs(w: WorkOrder, dto: Partial<WorkOrderDto>) {
    if (dto.incidentId !== undefined) {
      if (dto.incidentId) {
        const inc = await this.incidents.findOne({ where: [{ incidentId: dto.incidentId }, { incidentCode: dto.incidentId }] });
        if (!inc) throw new BadRequestException(`Incident ${dto.incidentId} not found`);
        w.incident = inc;
      } else w.incident = null;
    }
    if (dto.groupId !== undefined) {
      w.group = dto.groupId ? (await this.groups.findOne({ where: { groupId: dto.groupId } })) ?? null : null;
    }
    if (dto.assignedTo !== undefined) {
      w.assignedTo = dto.assignedTo ? (await this.users.findOne({ where: { userId: dto.assignedTo } })) ?? null : null;
    }
  }
}
