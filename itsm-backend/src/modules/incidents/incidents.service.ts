import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull, LessThan, Not, In, Brackets } from "typeorm";
import { Incident } from "./entities/incident.entity";
import { IncidentActivity, ActivityType } from "./entities/incident-activity.entity";
import { Category } from "../categories/entities/category.entity";
import { SubCategory } from "../sub-category/entities/sub-category.entity";
import { User } from "../users/entities/user.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { Location } from "../location/entities/location.entity";
import { ServiceRequest } from "../requests/entities/request.entity";
import { Priority } from "../priority/entities/priority.entity";
import { CategoriesService } from "../categories/categories.service";
import { CreateIncidentDto } from "./dto/create-incident.dto";
import { UpdateIncidentDto } from "./dto/update-incident.dto";
import { AdminIncidentQueryDto } from "./dto/admin-incident-query.dto";
import { isStaff } from "../../common/utils/roles.util";
import { RuleEngineService } from "../itsm-config/rule-engine.service";
import { NotificationService } from "../itsm-config/notification.service";

// Fallback SLA if the selected priority has no SLA minutes configured yet.
const DEFAULT_RESPONSE_SLA_MINUTES = 30;
const DEFAULT_RESOLUTION_SLA_MINUTES = 8 * 60;

const INCIDENT_RELATIONS = {
  category: true,
  subCategory: true,
  assignedTo: true,
  assignmentGroup: { manager: true },
  createdBy: true,
  location: true,
  request: true,
};

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    @InjectRepository(Incident) private repo: Repository<Incident>,
    @InjectRepository(IncidentActivity) private activityRepo: Repository<IncidentActivity>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
    @InjectRepository(SubCategory) private subCategoryRepo: Repository<SubCategory>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(AssignmentGroup) private groupRepo: Repository<AssignmentGroup>,
    @InjectRepository(Location) private locationRepo: Repository<Location>,
    @InjectRepository(ServiceRequest) private requestRepo: Repository<ServiceRequest>,
    @InjectRepository(Priority) private priorityRepo: Repository<Priority>,
    private categoriesService: CategoriesService,
    private rules: RuleEngineService,
    private notifications: NotificationService,
  ) {}

  // ── ID generation ──────────────────────────────────────────────────────────
  private async generateIncidentCode(): Promise<string> {
    // Generate the next INC### code by taking the numeric max of existing codes.
    // Uses a raw query to avoid race conditions with in-memory counts.
    const res: Array<{ max_num: number | null }> = await this.repo.query(
      `SELECT MAX(CAST(REPLACE(COALESCE(incident_code, ''), 'INC', '') AS INTEGER)) AS max_num FROM incidents`
    );
    const maxNum = res?.[0]?.max_num ?? 0;
    const next = (Number(maxNum) || 0) + 1;
    return `INC${String(next).padStart(3, "0")}`;
  }

  // ── SLA targets ────────────────────────────────────────────────────────────
  /** Workgroup+Priority override (Configuration > SLA Matrix) wins over the Priority default. */
  private async slaMinutesFor(priorityName: string, groupId?: number | null) {
    const cfg = await this.priorityRepo.findOne({ where: { priorityName } });
    const override = await this.rules.resolveSlaOverride(groupId, priorityName);
    return {
      response: override?.responseMinutes ?? cfg?.responseSlaMinutes ?? DEFAULT_RESPONSE_SLA_MINUTES,
      resolution: override?.resolutionMinutes ?? cfg?.resolutionSlaMinutes ?? DEFAULT_RESOLUTION_SLA_MINUTES,
    };
  }

  private async retargetSla(incident: Incident, priorityName: string, newGroupId?: number | null) {
    const groupId = newGroupId !== undefined ? newGroupId : incident.assignmentGroup?.groupId;
    const m = await this.slaMinutesFor(priorityName, groupId);
    if (!incident.claimedAt) incident.slaResponseTarget = await this.rules.addSlaMinutes(incident.createdAt, m.response, groupId, incident.slaServiceWindowId);
    if (!incident.resolvedAt) incident.slaResolutionTarget = await this.rules.addSlaMinutes(incident.createdAt, m.resolution, groupId, incident.slaServiceWindowId);
    incident.slaWarningSent = false;
  }

  /** Chooses an assignee from a group's active members; null leaves the incident in the group queue. */
  private async pickAssignee(groupId: number, preferredUserId: number | null, locationId: number | null, requesterLocation?: string | null): Promise<{ user: User; reason: string } | null> {
    const group = await this.groupRepo.findOne({ where: { groupId }, relations: { members: true } });
    const members = (group?.members ?? []).filter((m) => m.isActive);
    if (!members.length) return null;
    if (preferredUserId) {
      const p = members.find((m) => m.userId === preferredUserId);
      if (p) return { user: p, reason: "category's preferred member" };
    }
    let wanted = requesterLocation ?? null;
    if (locationId) wanted = (await this.locationRepo.findOne({ where: { locationId } }))?.locationName ?? wanted;
    if (!wanted) return null;
    const local = members.filter((m) => (m.location ?? "").trim().toLowerCase() === wanted!.trim().toLowerCase());
    if (!local.length) return null;
    const loads = await Promise.all(local.map(async (m) => ({
      m, n: await this.repo.count({ where: { assignedTo: { userId: m.userId }, status: Not(In(["Resolved", "Closed", "Cancelled"])) } }),
    })));
    loads.sort((a, b) => a.n - b.n || a.m.userId - b.m.userId);
    return { user: loads[0].m, reason: `resolver at ${wanted}, fewest open incidents` };
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  async validateChatDraft(dto: CreateIncidentDto, actorRoles: string[] = []) {
    const actorIsStaff = actorRoles.some((r) =>
      ["Admin", "Administrator", "Fulfiller", "IT Agent", "IT Manager", "Service Desk", "Engineer", "Agent"].includes(r),
    );
    try {
      await this.rules.applyLogIncidentFields(dto, actorIsStaff);
      return { missingFields: [] as string[] };
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
      const missing = /^Please fill in the required fields?: (.+)\.$/i.exec(error.message);
      if (!missing) throw error;
      return { missingFields: missing[1].split(/,\s*/) };
    }
  }

  suggestPriority(impact: string, urgency: string): Promise<string | null> {
    return this.rules.derivePriority(impact, urgency);
  }

  async create(createdByUserId: number, dto: CreateIncidentDto, actorRoles: string[] = [], trustedGroupId?: number): Promise<Incident> {
    const actorIsStaff = actorRoles.some((r) => ["Admin", "Administrator", "Fulfiller", "IT Agent", "IT Manager", "Service Desk", "Engineer", "Agent"].includes(r));
    // Anyone may pick the Caller (searchable field); the person who actually logged it is kept in loggedBy.
    dto = await this.rules.applyLogIncidentFields(dto, actorIsStaff);
    const effectiveCallerId = dto.callerId ?? createdByUserId;
    const createdBy = await this.userRepo.findOne({ where: { userId: effectiveCallerId } });
    if (!createdBy) throw new NotFoundException(`User ${effectiveCallerId} not found`);

    const incidentCode = await this.generateIncidentCode();
    // Priority comes from the Impact × Urgency matrix. Staff may override it explicitly; for requesters the matrix wins.
    const derivedPriority = await this.rules.derivePriority(dto.impact ?? "Medium", dto.urgency ?? "Medium");
    const priorityName = actorIsStaff && dto.priority ? dto.priority : (derivedPriority ?? dto.priority ?? "Medium");

    // Response & Resolution SLA are defined per Priority level in Admin > Priority.
    // Fall back to a sane default if this priority hasn't had SLA minutes configured.
    const priorityConfig = await this.priorityRepo.findOne({ where: { priorityName } });
    const responseSlaMinutes = priorityConfig?.responseSlaMinutes ?? DEFAULT_RESPONSE_SLA_MINUTES;
    const resolutionSlaMinutes = priorityConfig?.resolutionSlaMinutes ?? DEFAULT_RESOLUTION_SLA_MINUTES;

    const now = new Date();
    const slaResponseTarget = new Date(now.getTime() + responseSlaMinutes * 60 * 1000);
    const slaResolutionTarget = new Date(now.getTime() + resolutionSlaMinutes * 60 * 1000);

    const incident = this.repo.create({
      // Use the human-friendly code as the primary key (INC001, INC002...)
      incidentId: incidentCode,
      incidentCode,
      title: dto.title,
      description: dto.description,
      priority: (priorityName as any),
      impact: (dto.impact as any) ?? "Medium",
      urgency: (dto.urgency as any) ?? "Medium",
      status: "Open",
      affectedAsset: dto.affectedAsset,
      businessService: dto.businessService,
      contactNumber: dto.contactNumber,
      department: dto.department,
      classificationId: dto.classificationId ?? null,
      contactType: dto.contactType ?? null,
      callerEmail: dto.callerEmail ?? createdBy.email,
      loggedBy: effectiveCallerId !== createdByUserId ? createdByUserId : null,
      slaResponseTarget,
      slaResolutionTarget,
    });

    if (dto.categoryId) incident.category = await this.categoryRepo.findOne({ where: { categoryId: dto.categoryId } }) || undefined;
    if (dto.subCategoryId) incident.subCategory = await this.subCategoryRepo.findOne({ where: { subCategoryId: dto.subCategoryId } }) || undefined;
    // Assigning a group at creation time is an Admin/Fulfiller action, same as
    // reassigning one later via PATCH /incidents/:id/assignment-group. A plain
    // requester's dto.assignmentGroupId is silently ignored rather than honored.
    const isFulfiller = actorRoles.includes("Admin") || actorRoles.includes("Administrator") || actorRoles.includes("Fulfiller") || actorRoles.includes("IT Agent") || actorRoles.includes("IT Manager") || actorRoles.includes("Service Desk");
    const canSetGroup = isFulfiller;
    if (trustedGroupId) {
      incident.assignmentGroup = await this.groupRepo.findOne({ where: { groupId: trustedGroupId, isActive: true } }) || undefined;
      if (!incident.assignmentGroup) throw new NotFoundException(`Assignment group ${trustedGroupId} not found`);
    } else if (dto.assignmentGroupId && canSetGroup) {
      incident.assignmentGroup = await this.groupRepo.findOne({ where: { groupId: dto.assignmentGroupId } }) || undefined;
    }
    
    // Routing: explicit (staff) > category's Default Assignment Group > category's Workgroup > system default group.
    // Each category setting is inherited from the nearest ancestor that sets it.
    const routing = dto.categoryId ? await this.categoriesService.getEffectiveRouting(dto.categoryId) : null;
    if (!incident.assignmentGroup) {
      const gid = routing?.groupId ?? routing?.workgroupId ?? null;
      const routedGroup = gid ? await this.groupRepo.findOne({ where: { groupId: gid } }) : null;
      incident.assignmentGroup = routedGroup ?? (await this.groupRepo.findOne({ where: { isDefault: true } })) ?? undefined;
    }

    if (dto.locationId) incident.location = await this.locationRepo.findOne({ where: { locationId: dto.locationId } }) || undefined;
    // No location chosen: default to the caller's own location (matched by name) so tickets are routed and reported by site.
    else if (createdBy?.location) incident.location = await this.locationRepo.createQueryBuilder("l").where("lower(l.locationName) = lower(:n)", { n: createdBy.location.trim() }).getOne() || undefined;
    if (dto.requestId) incident.request = await this.requestRepo.findOne({ where: { requestId: dto.requestId } }) || undefined;
    incident.createdBy = createdBy;
    if (dto.slaServiceWindowId && actorIsStaff) incident.slaServiceWindowId = dto.slaServiceWindowId;
    if (dto.assignedTo && actorIsStaff) {
      const agent = await this.userRepo.findOne({ where: { userId: dto.assignedTo } });
      if (!agent) throw new NotFoundException(`User ${dto.assignedTo} not found`);
      incident.assignedTo = agent;
      incident.status = "Assigned";
      incident.claimedAt = now;
    }

    // Auto-assign a person when nobody was chosen: the category's preferred member, else a resolver at the
    // incident's location (least-loaded), but only from the chosen group's active members.
    let autoAssignNote: string | null = null;
    if (!incident.assignedTo && incident.assignmentGroup) {
      const pick = await this.pickAssignee(incident.assignmentGroup.groupId, routing?.memberId ?? null, dto.locationId ?? routing?.locationId ?? null, createdBy.location);
      if (pick) {
        incident.assignedTo = pick.user; incident.status = "Assigned"; incident.claimedAt = now;
        autoAssignNote = `Auto-assigned to ${pick.user.fullName} (${pick.reason}).`;
      }
    }

    // The SLA Matrix is keyed by workgroup, which is only known now.
    const slaMins = await this.slaMinutesFor(priorityName, incident.assignmentGroup?.groupId);
    const groupIdForSla = incident.assignmentGroup?.groupId;
    incident.slaResponseTarget = await this.rules.addSlaMinutes(now, slaMins.response, groupIdForSla, incident.slaServiceWindowId);
    incident.slaResolutionTarget = await this.rules.addSlaMinutes(now, slaMins.resolution, groupIdForSla, incident.slaServiceWindowId);
    // Assigned at creation counts as an immediate response; otherwise it stays unmet until someone claims it.
    incident.slaResponseMet = !!incident.claimedAt && (!incident.slaResponseTarget || incident.claimedAt <= incident.slaResponseTarget);

    const saved = await this.repo.save(incident);

    // Log creation activity
    await this.logActivity(saved, createdBy, "created", `Incident ${incidentCode} created.`);
    if (autoAssignNote) await this.logActivity(saved, undefined, "assignment_change", autoAssignNote);

    const created = await this.findOne(saved.incidentId);
    void this.notifications.dispatch("created", created);
    if (created.assignedTo) void this.notifications.dispatch("assigned", created);
    return created;
  }

  // ── Queue — unassigned incidents for a group ───────────────────────────────
  async getGroupQueue(groupId: number, actorId: number, actorRoles: string[] = []): Promise<Incident[]> {
    await this.assertCanJoinGroupQueue(groupId, actorId, actorRoles);
    return this.repo.find({
      where: {
        assignmentGroup: { groupId },
        assignedTo: IsNull(),
        status: Not(In(["Closed", "Resolved"])),
      },
      relations: INCIDENT_RELATIONS,
      order: { createdAt: "DESC" },
    });
  }

  async assertCanJoinGroupQueue(groupId: number, actorId: number, actorRoles: string[] = []): Promise<void> {
    const isAdmin = actorRoles.some((role) => ["Admin", "Administrator"].includes(role));
    if (!isAdmin && !(await this.isGroupMember(groupId, actorId))) {
      throw new ForbiddenException("You are not a member of this assignment group.");
    }
  }

  /** Agent claims an unassigned incident from the queue. Only members of the
   *  incident's assignment group (or Admins) may claim it. */
  async claimIncident(incidentId: string, agentUserId: number, agentRoles: string[] = []): Promise<Incident> {
    const incident = await this.findOne(incidentId);
    if (incident.assignedTo) {
      throw new ForbiddenException(
        `Incident ${incident.incidentCode} is already claimed by ${incident.assignedTo.fullName}`
      );
    }
    const agent = await this.userRepo.findOne({ where: { userId: agentUserId } });
    if (!agent) throw new NotFoundException(`User ${agentUserId} not found`);

    const isAdmin = agentRoles.includes("Admin") || agentRoles.includes("Administrator");
    if (!isAdmin) {
      if (!incident.assignmentGroup) {
        throw new ForbiddenException(
          `Incident ${incident.incidentCode} has no assignment group yet and cannot be claimed.`
        );
      }
      const isMember = await this.isGroupMember(incident.assignmentGroup.groupId, agentUserId);
      if (!isMember) {
        throw new ForbiddenException(
          `You are not a member of ${incident.assignmentGroup.groupName} and cannot claim this incident.`
        );
      }
    }

    incident.assignedTo = agent;
    incident.status = "Assigned";
    await this.retargetSla(incident, incident.priority as string, incident.assignmentGroup?.groupId);
    if (!incident.claimedAt) {
      incident.claimedAt = new Date();
      incident.slaResponseMet = !incident.slaResponseTarget || incident.claimedAt <= incident.slaResponseTarget;
    }
    const saved = await this.repo.save(incident);

    await this.logActivity(saved, agent, "claimed",
      `Incident claimed and assigned to ${agent.fullName}.`,
      { agentName: agent.fullName }
    );

    const claimed = await this.findOne(saved.incidentId);
    void this.notifications.dispatch("assigned", claimed);
    return claimed;
  }

  /** Agent releases their claimed incident back to the group queue. Only the
   *  current assignee (or an Admin) may release it. */
  async releaseIncident(incidentId: string, actorId: number, actorRoles: string[] = []): Promise<Incident> {
    const incident = await this.findOne(incidentId);
    if (!incident.assignedTo) {
      throw new ForbiddenException(`Incident ${incident.incidentCode} is not currently assigned to anyone.`);
    }

    const isAdmin = actorRoles.includes("Admin") || actorRoles.includes("Administrator");
    if (!isAdmin && incident.assignedTo.userId !== actorId) {
      throw new ForbiddenException(
        `Only ${incident.assignedTo.fullName} or an Admin can release this incident.`
      );
    }

    const actor = await this.userRepo.findOne({ where: { userId: actorId } });
    const previousAssignee = incident.assignedTo.fullName;

    incident.assignedTo = undefined;
    incident.status = "Open";
    const saved = await this.repo.save(incident);

    await this.logActivity(saved, actor ?? undefined, "released",
      `Released back to ${incident.assignmentGroup?.groupName ?? "the group"} queue by ${actor?.fullName ?? "unknown"} (was assigned to ${previousAssignee}).`,
      { releasedBy: actor?.fullName, previousAssignee }
    );

    return this.findOne(saved.incidentId);
  }

  async createHandoverIncident(userId: number, summary: string, roles: string[] = []): Promise<Incident> {
    const serviceDesks = (await this.groupRepo.find({ where: { isActive: true } }))
      .filter((group) => group.groupName.trim().toLowerCase() === "service desk");
    if (serviceDesks.length !== 1) {
      throw new NotFoundException("Configure exactly one active Service Desk assignment group before enabling chatbot handover.");
    }
    return this.create(userId, {
      title: "Chatbot handover to Service Desk",
      description: summary,
      assignmentGroupId: serviceDesks[0].groupId,
    }, roles, serviceDesks[0].groupId);
  }

  /** Admin/Fulfiller assigns (or reassigns) which group owns this incident. */
  async assignGroup(incidentId: string, groupId: number, actorId?: number): Promise<Incident> {
    const incident = await this.findOne(incidentId);
    const group = await this.groupRepo.findOne({ where: { groupId } });
    if (!group) throw new NotFoundException(`Assignment group ${groupId} not found`);

    const actor = actorId ? await this.userRepo.findOne({ where: { userId: actorId } }) ?? undefined : undefined;
    const prevName = incident.assignmentGroup?.groupName ?? "Unassigned";

    incident.assignmentGroup = group;
    await this.retargetSla(incident, incident.priority as string, group.groupId);
    const saved = await this.repo.save(incident);

    if (prevName !== group.groupName) {
      await this.logActivity(saved, actor, "group_assigned",
        `Assignment group changed from ${prevName} to ${group.groupName}.`,
        { from: prevName, to: group.groupName }
      );
    }

    return this.findOne(saved.incidentId);
  }

  private async isGroupMember(groupId: number, userId: number): Promise<boolean> {
    const group = await this.groupRepo.findOne({
      where: { groupId },
      relations: { members: true },
    });
    return !!group?.members?.some((m) => m.userId === userId);
  }

  // ── SLA sweep ──────────────────────────────────────────────────────────────
  // Claiming and resolving finalize the SLA flags the moment those actions
  // happen, but an incident that's just sitting untouched (never claimed,
  // never resolved) needs something to notice it blew past its target. This
  // periodic sweep is that something — it marks slaBreached true on any open
  // incident whose response or resolution target has already passed.
  @Cron(CronExpression.EVERY_MINUTE)
  async sweepSlaBreaches(): Promise<void> {
    const now = new Date();
    const OPEN_STATUSES = ["Open", "Assigned", "In Progress", "Pending Customer", "On Hold"];

    // 1) Mark breaches (paused incidents are skipped; their clock isn't running).
    const due = await this.repo.createQueryBuilder("i")
      .where("i.status IN (:...openStatuses)", { openStatuses: OPEN_STATUSES })
      .andWhere("i.sla_breached = false")
      .andWhere("i.sla_paused_at IS NULL")
      .andWhere("((i.sla_resolution_target IS NOT NULL AND i.sla_resolution_target < :now) OR (i.claimed_at IS NULL AND i.sla_response_target IS NOT NULL AND i.sla_response_target < :now))", { now })
      .getMany();
    for (const inc of due) {
      await this.repo.update({ incidentId: inc.incidentId }, { slaBreached: true });
      await this.logActivity(inc, undefined, "sla_breached", `SLA breached for ${inc.incidentCode ?? inc.incidentId}.`);
    }
    if (due.length) this.logger.log(`SLA sweep: marked ${due.length} incident(s) as breached.`);

    // 2) Early warning, once per target: within the lesser of 60 minutes or 20% of the total resolution time.
    const candidates = await this.repo.createQueryBuilder("i")
      .leftJoinAndSelect("i.assignedTo", "assignedTo").leftJoinAndSelect("i.assignmentGroup", "assignmentGroup").leftJoinAndSelect("i.createdBy", "createdBy")
      .where("i.status IN (:...openStatuses)", { openStatuses: OPEN_STATUSES })
      .andWhere("i.sla_breached = false AND i.sla_warning_sent = false AND i.sla_paused_at IS NULL AND i.sla_resolution_target IS NOT NULL")
      .andWhere("i.sla_resolution_target > :now", { now })
      .getMany();
    for (const inc of candidates) {
      const total = new Date(inc.slaResolutionTarget!).getTime() - new Date(inc.createdAt).getTime();
      const window = Math.min(60 * 60 * 1000, total * 0.2);
      if (new Date(inc.slaResolutionTarget!).getTime() - now.getTime() <= window) {
        await this.repo.update({ incidentId: inc.incidentId }, { slaWarningSent: true });
        void this.notifications.dispatch("slaBreachWarning", inc);
      }
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────────
  findAllForUser(userId: number): Promise<Incident[]> {
    return this.repo.find({
      where: [
        { createdBy: { userId } },
        { assignedTo: { userId } },
        { loggedBy: userId },
      ],
      relations: INCIDENT_RELATIONS,
      order: { createdAt: "DESC" },
    });
  }

  findAssignedToUser(userId: number): Promise<Incident[]> {
    return this.repo.find({
      where: { assignedTo: { userId }, status: Not(In(["Closed", "Resolved"])) },
      relations: INCIDENT_RELATIONS,
      order: { createdAt: "DESC" },
    });
  }

  findAll(): Promise<Incident[]> {
    return this.repo.find({
      relations: INCIDENT_RELATIONS,
      order: { createdAt: "DESC" },
    });
  }

  findFiltered(filter: { groupId?: number; assignedToUserId?: number; openOnly?: boolean }): Promise<Incident[]> {
    const where: any = {};
    if (filter.groupId) where.assignmentGroup = { groupId: filter.groupId };
    if (filter.assignedToUserId) where.assignedTo = { userId: filter.assignedToUserId };
    if (filter.openOnly) where.status = Not(In(["Closed", "Resolved"]));
    return this.repo.find({
      where,
      relations: INCIDENT_RELATIONS,
      order: { createdAt: "DESC" },
    });
  }

  findAdminList(query: AdminIncidentQueryDto): Promise<Incident[]> {
    const builder = this.repo.createQueryBuilder("incident")
      .leftJoinAndSelect("incident.category", "category")
      .leftJoinAndSelect("incident.subCategory", "subCategory")
      .leftJoinAndSelect("incident.assignedTo", "assignedTo")
      .leftJoinAndSelect("incident.assignmentGroup", "assignmentGroup")
      .leftJoinAndSelect("assignmentGroup.manager", "groupManager")
      .leftJoinAndSelect("incident.createdBy", "createdBy")
      .leftJoinAndSelect("incident.location", "location")
      .leftJoinAndSelect("incident.request", "request")
      .orderBy("incident.createdAt", "DESC");

    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      builder.andWhere(new Brackets((where) => where
        .where("LOWER(incident.incidentId) LIKE :search", { search })
        .orWhere("LOWER(incident.title) LIKE :search", { search })
        .orWhere("LOWER(category.categoryName) LIKE :search", { search })
        .orWhere("LOWER(assignmentGroup.groupName) LIKE :search", { search })
        .orWhere("LOWER(assignedTo.fullName) LIKE :search", { search })
        .orWhere("LOWER(createdBy.fullName) LIKE :search", { search })
      ));
    }
    if (query.status) builder.andWhere("incident.status = :status", { status: query.status });
    if (query.priority) builder.andWhere("incident.priority = :priority", { priority: query.priority });
    if (query.impact) builder.andWhere("incident.impact = :impact", { impact: query.impact });
    if (query.urgency) builder.andWhere("incident.urgency = :urgency", { urgency: query.urgency });
    if (query.categoryId) builder.andWhere("category.categoryId = :categoryId", { categoryId: query.categoryId });
    if (query.subCategoryId) builder.andWhere("subCategory.subCategoryId = :subCategoryId", { subCategoryId: query.subCategoryId });
    if (query.assignmentGroupId) builder.andWhere("assignmentGroup.groupId = :assignmentGroupId", { assignmentGroupId: query.assignmentGroupId });
    if (query.assignedToId) builder.andWhere("assignedTo.userId = :assignedToId", { assignedToId: query.assignedToId });
    if (query.createdById) builder.andWhere("createdBy.userId = :createdById", { createdById: query.createdById });
    if (query.locationId) builder.andWhere("location.locationId = :locationId", { locationId: query.locationId });
    if (query.createdFrom) builder.andWhere("incident.createdAt >= :createdFrom", { createdFrom: query.createdFrom });
    if (query.createdTo) builder.andWhere("incident.createdAt <= :createdTo", { createdTo: `${query.createdTo}T23:59:59.999Z` });
    if (query.slaBreached !== undefined) builder.andWhere("incident.slaBreached = :slaBreached", { slaBreached: query.slaBreached });

    return builder.getMany();
  }

  /** Returns incidents only for the user's assigned workgroups. */
  async findForWorkgroup(userId: number): Promise<Incident[]> {
    const groups = await this.groupRepo.find({ relations: { members: true } });
    const userGroupIds = groups
      .filter((group) => group.members?.some((member) => member.userId === userId))
      .map((group) => group.groupId);

    if (userGroupIds.length === 0) return [];

    return this.repo.find({
      where: userGroupIds.map((groupId) => ({ assignmentGroup: { groupId } })),
      relations: INCIDENT_RELATIONS,
      order: { createdAt: "DESC" },
    });
  }

  async findOne(incidentId: string): Promise<Incident> {
    const incident = await this.repo.findOne({
      where: { incidentId },
      relations: INCIDENT_RELATIONS,
    });
    if (!incident) throw new NotFoundException(`Incident ${incidentId} not found`);
    return incident;
  }

  async findByCode(code: string): Promise<Incident> {
    const incident = await this.repo.findOne({
      where: { incidentCode: code },
      relations: INCIDENT_RELATIONS,
    });
    if (!incident) throw new NotFoundException(`Incident ${code} not found`);
    return incident;
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  async update(
    incidentId: string,
    dto: UpdateIncidentDto,
    actorId?: number,
    actorRoles?: string[],
  ): Promise<Incident> {
    const external = Array.isArray(actorRoles);        // internal callers (resolve, resume-sla, …) omit roles and are trusted
    actorRoles = actorRoles ?? [];
    // Engineers may edit every other incident field/option, but the
    // Description is locked once the incident is logged — enforced here so
    // it can't be bypassed by calling the API directly (UI also disables
    // the field, see IncidentDetailPage).
    const isEngineerOnly =
      actorRoles.includes("Engineer") &&
      !actorRoles.some((r) => ["Admin", "Administrator", "IT Manager", "Service Desk"].includes(r));
    if (isEngineerOnly && dto.description !== undefined) {
      throw new ForbiddenException("Engineers cannot modify the incident Description.");
    }

    // Priority / Impact / Urgency / Status are NOT NULL columns: a blank or null ("None") means "no change", never "clear it".
    for (const k of ["priority", "impact", "urgency", "status"] as const) {
      const v = (dto as any)[k];
      if (v === null || (typeof v === "string" && !v.trim())) delete (dto as any)[k];
    }
    const incident = await this.findOne(incidentId);
    if (external && !isStaff(actorRoles)) this.assertRequesterMayPatch(incident, dto, actorId);
    const actor = actorId ? await this.userRepo.findOne({ where: { userId: actorId } }) || undefined : undefined;

    const priorityOverrideReason = dto.priorityOverrideReason?.trim();
    delete (dto as any).priorityOverrideReason;
    const statusAfter = dto.status ?? incident.status;

    // Resolved / Closed records are locked: only a status change (Reopen / Close) or the requester's closing feedback is accepted.
    if (external && ["Resolved", "Closed"].includes(incident.status)) {
      const allowed = new Set(["status", "closureCode", "feedbackRating", "feedbackComment", "resolutionNotes", "resolutionCode"]);
      const edited = Object.entries(dto).filter(([k, v]) => v !== undefined && !allowed.has(k)).map(([k]) => k);
      if (incident.status === "Closed" && Object.keys(dto).some((k) => (dto as any)[k] !== undefined && k !== "status")) {
        throw new BadRequestException("This incident is Closed and locked. Raise a Reopen request instead.");
      }
      if (edited.length) {
        throw new BadRequestException("This incident is Resolved and locked. Reopen it to change " + edited.join(", ") + ".");
      }
    }

    // Priority is derived from Impact × Urgency. A manual override needs a written reason and is audited below.
    if ((dto.impact !== undefined || dto.urgency !== undefined) && dto.priority === undefined) {
      const derived = await this.rules.derivePriority(dto.impact ?? incident.impact, dto.urgency ?? incident.urgency);
      if (derived && derived !== incident.priority) dto.priority = derived;
    } else if (external && dto.priority !== undefined && dto.priority !== incident.priority) {
      const derived = await this.rules.derivePriority(dto.impact ?? incident.impact, dto.urgency ?? incident.urgency);
      if (derived && derived !== dto.priority) {
        if (!isStaff(actorRoles)) throw new ForbiddenException("Priority is calculated from Impact and Urgency and cannot be changed manually.");
        if (!priorityOverrideReason) throw new BadRequestException(`Priority is calculated as "${derived}" from Impact and Urgency. Provide an override reason to set "${dto.priority}".`);
      }
    }

    // ── Configuration-driven rules (reject BEFORE anything is changed) ──
    const prevStatus = incident.status;
    const prevAssigneeId = incident.assignedTo?.userId ?? null;
    const statusChanging = !!dto.status && dto.status !== prevStatus;
    let approvalsToConsume: Awaited<ReturnType<RuleEngineService["assertApproval"]>> = [];
    // Only the Caller (the user the incident was raised for) may close it; resolvers resolve, the caller confirms.
    if (statusChanging && dto.status === "Closed" && external && incident.createdBy?.userId !== actorId) {
      throw new ForbiddenException("Only the Caller of this incident can close it.");
    }
    if (statusChanging) {
      await this.rules.assertTransitionAllowed(prevStatus, dto.status!);
      const action = this.rules.lifecycleAction(prevStatus, dto.status!);
      if (action) approvalsToConsume = await this.rules.assertApproval(incident, action, actorId);
    }
    await this.rules.assertMandatoryFields(incident, {
      status: dto.status, priority: dto.priority, urgency: dto.urgency, impact: dto.impact,
      categoryId: dto.categoryId, assignedTo: dto.assignedTo, groupId: dto.groupId,
      resolutionNotes: dto.resolutionNotes, closureCode: dto.closureCode, feedbackRating: dto.feedbackRating,
      pendingReason: dto.pendingReason, classificationId: dto.classificationId, onHoldReason: dto.onHoldReason,
    });

    // Leaving a paused status pushes the Resolution target out by the time spent paused.
    if (statusChanging && incident.slaPausedAt) {
      const pausedMs = Date.now() - new Date(incident.slaPausedAt).getTime();
      if (incident.slaResolutionTarget) incident.slaResolutionTarget = new Date(new Date(incident.slaResolutionTarget).getTime() + pausedMs);
      incident.slaWarningSent = false;
      incident.slaPausedAt = null;
    }
    // Entering On Hold / Pending Customer: the chosen reason decides whether the clock pauses.
    if (statusChanging && dto.status === "On Hold") {
      this.rules.assertOnHoldReason(dto.onHoldReason !== undefined ? dto.onHoldReason : incident.onHoldReason);
    }
    if (statusChanging && this.rules.isPausingStatus(dto.status!)) {
      const holdReason = dto.onHoldReason !== undefined ? dto.onHoldReason : incident.onHoldReason;
      const pendReason = dto.pendingReason !== undefined ? dto.pendingReason : incident.pendingReason;
      if (await this.rules.statusPausesSla(dto.status!, holdReason, pendReason)) incident.slaPausedAt = new Date();
    }
    if (statusChanging && dto.status === "Resolved") {
      await this.rules.assertResolveGates(incident.incidentId);
      if (external) this.rules.assertResolutionNotes(dto.resolutionNotes, incident.resolutionNotes);
      if (external) await this.rules.assertResolutionCode(dto.resolutionCode, incident.resolutionCode);
    }
    if (dto.feedbackRating !== undefined && dto.feedbackRating !== incident.feedbackRating) {
      incident.feedbackSubmittedAt = dto.feedbackRating == null ? null : new Date();
      incident.feedbackModeratedAt = null; incident.feedbackModeratedBy = null;
      incident.feedbackPublished = false; incident.feedbackFlagged = false;
    }

    if (dto.status && dto.status !== incident.status) {
      await this.logActivity(incident, actor, "status_change",
        `Status changed from ${incident.status} to ${dto.status}.`,
        { from: incident.status, to: dto.status }
      );
      if (dto.status === "Resolved") {
        incident.resolvedAt = new Date();
        // Finalize the resolution SLA the moment it's actually resolved, rather
        // than waiting for the next sweep — this is the authoritative check.
        if (incident.slaResolutionTarget && incident.resolvedAt > incident.slaResolutionTarget) {
          incident.slaBreached = true;
        }
      } else if (dto.status === "Closed") {
        incident.closedAt = new Date();
      } else if (dto.status === "Open") {
        incident.resolvedAt = undefined;
        incident.closedAt = undefined;
      }
    }

    if (dto.assignedTo !== undefined) {
      const newAgent = dto.assignedTo
        ? await this.userRepo.findOne({ where: { userId: dto.assignedTo } }) || undefined : undefined;
      const prevName = incident.assignedTo?.fullName ?? "Unassigned";
      const newName = newAgent?.fullName ?? "Unassigned";
      if (prevName !== newName) {
        await this.logActivity(incident, actor, "assignment_change",
          `Assignment changed from ${prevName} to ${newName}.`,
          { from: prevName, to: newName }
        );
      }
      incident.assignedTo = newAgent;
      // First assignment is the response: record it so the Response SLA can be judged.
      if (newAgent && !incident.claimedAt) {
        incident.claimedAt = new Date();
        incident.slaResponseMet = !incident.slaResponseTarget || incident.claimedAt <= incident.slaResponseTarget;
      }
    }

    if (dto.slaServiceWindowId !== undefined && (dto.slaServiceWindowId ?? null) !== (incident.slaServiceWindowId ?? null)) {
      incident.slaServiceWindowId = dto.slaServiceWindowId ?? null;
      await this.logActivity(incident, actor, "sla_window_change",
        dto.slaServiceWindowId ? `SLA service window changed (id ${dto.slaServiceWindowId}).` : "SLA service window reset to the workgroup default.");
      // Re-anchor both targets on the new window, using the priority/group this same save may also change.
      await this.retargetSla(incident, (dto.priority ?? incident.priority) as string, dto.groupId);
    }

    if (dto.priority && dto.priority !== incident.priority) {
      await this.logActivity(incident, actor, "priority_change",
        `Priority changed from ${incident.priority} to ${dto.priority}.` + (priorityOverrideReason ? ` Override reason: ${priorityOverrideReason}` : ""),
        { from: incident.priority, to: dto.priority, reason: priorityOverrideReason ?? null }
      );
      // Re-target Response & Resolution SLA (SLA Matrix override > Priority default),
      // still anchored to when the incident was created.
      await this.retargetSla(incident, dto.priority, dto.groupId);
    }

    if (dto.urgency && dto.urgency !== incident.urgency) {
      await this.logActivity(incident, actor, "urgency_change",
        `Urgency changed from ${incident.urgency} to ${dto.urgency}.`,
        { from: incident.urgency, to: dto.urgency }
      );
    }

    if (dto.impact && dto.impact !== incident.impact) {
      await this.logActivity(incident, actor, "impact_change",
        `Impact changed from ${incident.impact} to ${dto.impact}.`,
        { from: incident.impact, to: dto.impact }
      );
    }

    if (dto.categoryId !== undefined) {
      incident.category = (await this.categoryRepo.findOne({ where: { categoryId: dto.categoryId } })) || undefined;
    }
    if (dto.subCategoryId !== undefined) {
      incident.subCategory =
        (await this.subCategoryRepo.findOne({ where: { subCategoryId: dto.subCategoryId } })) || undefined;
    }
    if (dto.groupId !== undefined) {
      const newGroup = dto.groupId
        ? (await this.groupRepo.findOne({ where: { groupId: dto.groupId } })) || undefined
        : undefined;
      const prevName = incident.assignmentGroup?.groupName ?? "Unassigned";
      const newGroupName = newGroup?.groupName ?? "Unassigned";
      if (prevName !== newGroupName) {
        await this.logActivity(incident, actor, "assignment_change",
          `Assignment group changed from ${prevName} to ${newGroupName}.`,
          { from: prevName, to: newGroupName }
        );
      }
      incident.assignmentGroup = newGroup;
      if (!dto.priority && prevName !== newGroupName) {
        await this.retargetSla(incident, incident.priority as string, newGroup?.groupId ?? null);
      }
    }
    if (dto.locationId !== undefined) {
      incident.location = (await this.locationRepo.findOne({ where: { locationId: dto.locationId } })) || undefined;
    }

    const { assignedTo, categoryId, subCategoryId, groupId, locationId, ...rest } = dto as any;
    Object.assign(incident, rest);
    const saved = await this.repo.save(incident);
    await this.rules.consume(approvalsToConsume);

    // Anyone newly put on the incident hears about it, even when the status label doesn't change.
    const assigneeChanged = (saved.assignedTo?.userId ?? null) !== prevAssigneeId && !!saved.assignedTo;
    if (assigneeChanged && !(statusChanging && dto.status === "Assigned")) void this.notifications.dispatch("assigned", saved);

    if (statusChanging && dto.status) {
      const event: Record<string, string> = {
        Resolved: "resolved", Closed: "closed", "On Hold": "onHold", "Pending Customer": "pendingCustomer", Assigned: "assigned",
      };
      const e = this.rules.lifecycleAction(prevStatus, dto.status) === "Reopen" ? "reopened" : (event[dto.status] ?? (this.rules.isPendingStatus(dto.status) ? "pendingCustomer" : undefined));
      if (e) void this.notifications.dispatch(e, saved);
      // Dispatch status-specific trigger events so rules configured for "Open", "Assigned", "In Progress", etc. fire
      void this.notifications.dispatch(dto.status, saved);
      void this.notifications.dispatch(`status:${dto.status}`, saved);
    }
    return saved;
  }

  /** Chat exposes only this additional requester edit; standard PATCH permissions remain unchanged. */
  async updateContactFromChat(incidentId: string, contactNumber: string, actorId: number, actorRoles: string[] = []) {
    const incident = await this.assertCanAccess(incidentId, actorId, actorRoles);
    if (!isStaff(actorRoles) && incident.createdBy?.userId !== actorId) {
      throw new ForbiddenException("Only the Caller of this incident can change its contact number.");
    }
    if (incident.status === "Closed") {
      throw new BadRequestException("This incident is Closed and locked. Raise a Reopen request instead.");
    }
    if (incident.status === "Resolved") {
      throw new BadRequestException("This incident is Resolved and locked. Reopen it to change contact number.");
    }
    const normalized = contactNumber.trim();
    if (!/^\+?[0-9][0-9 ()-]{5,18}$/.test(normalized)) {
      throw new BadRequestException("Contact Number must be a valid phone number (digits, spaces, + ( ) - only; 6-20 characters).");
    }
    incident.contactNumber = normalized;
    const saved = await this.repo.save(incident);
    const actor = await this.userRepo.findOne({ where: { userId: actorId } });
    await this.logActivity(saved, actor ?? undefined, "comment", "Contact number updated.");
    return saved;
  }

  async addChatComment(incidentId: string, actorId: number, content: string, isWorkNote: boolean, actorRoles: string[] = []) {
    const incident = await this.assertCanAccess(incidentId, actorId, actorRoles);
    if (incident.status === "Closed") {
      throw new BadRequestException("This incident is Closed and locked. Raise a Reopen request instead.");
    }
    if (incident.status === "Resolved") {
      throw new BadRequestException("This incident is Resolved and locked. Reopen it to add information.");
    }
    if (!content.trim() || content.length > 2000) {
      throw new BadRequestException("The comment must be between 1 and 2000 characters.");
    }
    if (isWorkNote && !isStaff(actorRoles)) {
      throw new ForbiddenException("Only authorized support staff can add internal work notes.");
    }
    return this.addComment(incidentId, actorId, content.trim(), isWorkNote, actorRoles);
  }

  async remove(incidentId: string): Promise<void> {
    const incident = await this.findOne(incidentId);
    await this.repo.remove(incident);
  }

  // ── Activity / conversation ────────────────────────────────────────────────
  // The frontend's IncidentActivity type expects the acting user under the
  // `author` key; the entity itself models it as `actor` (matches the
  // actor_id column/relation name). Map at the boundary rather than
  // renaming the entity everywhere.
  private toActivityDto(a: IncidentActivity) {
    const { actor, ...rest } = a;
    return {
      ...rest,
      author: actor ? { userId: actor.userId, fullName: actor.fullName } : null,
    };
  }

  /** Requesters may only confirm-and-close, reopen or rate their own resolved incident — nothing else. */
  private assertRequesterMayPatch(incident: Incident, dto: UpdateIncidentDto, actorId?: number): void {
    if (incident.createdBy?.userId !== actorId) throw new ForbiddenException("You don't have access to this incident.");
    const allowed = new Set(["status", "feedbackRating", "feedbackComment", "closureCode"]);
    const illegal = Object.keys(dto).filter((k) => (dto as any)[k] !== undefined && !allowed.has(k));
    if (illegal.length) throw new ForbiddenException(`Requesters can't change ${illegal.join(", ")}. Contact the support team instead.`);
    if (dto.status !== undefined && dto.status !== incident.status) {
      if (incident.status !== "Resolved" || !["Closed", "Open"].includes(dto.status)) {
        throw new ForbiddenException("You can only close or reopen an incident once it has been resolved.");
      }
    }
  }

  /** A requester may only touch incidents they reported; staff may touch any. */
  async assertCanAccess(incidentId: string, userId: number | undefined, roles: string[] | undefined): Promise<Incident> {
    const incident = await this.findOne(incidentId);
    if (!isStaff(roles) && incident.createdBy?.userId !== userId && incident.loggedBy !== userId) {
      throw new ForbiddenException("You don't have access to this incident.");
    }
    return incident;
  }

  /** When `viewer` is given the caller is an external user: requesters never see internal work notes. */
  async getActivity(incidentId: string, viewer?: { userId: number; roles: string[] }): Promise<ReturnType<IncidentsService["toActivityDto"]>[]> {
    if (viewer) await this.assertCanAccess(incidentId, viewer.userId, viewer.roles);
    else await this.findOne(incidentId);
    const activities = await this.activityRepo.find({
      where: { incident: { incidentId } },
      relations: { actor: true },
      order: { createdAt: "ASC" },
    });
    const visible = viewer && !isStaff(viewer.roles) ? activities.filter((a) => !a.isWorkNote && a.type !== "work_note") : activities;
    return visible.map((a) => this.toActivityDto(a));
  }

  async addComment(
    incidentId: string,
    actorId: number,
    content: string,
    isWorkNote = false,
    roles?: string[],
  ): Promise<ReturnType<IncidentsService["toActivityDto"]>> {
    const external = Array.isArray(roles);
    const incident = external ? await this.assertCanAccess(incidentId, actorId, roles) : await this.findOne(incidentId);
    if (external && !isStaff(roles)) isWorkNote = false;      // requesters can never write internal notes
    const actor = await this.userRepo.findOne({ where: { userId: actorId } });
    if (!actor) throw new NotFoundException(`User ${actorId} not found`);
    const activity = this.activityRepo.create({
      type: isWorkNote ? "work_note" : "comment",
      content,
      isWorkNote,
    });
    activity.incident = incident;
    activity.actor = actor;
    const saved = await this.activityRepo.save(activity);
    saved.actor = actor;
    return this.toActivityDto(saved);
  }

  private async logActivity(
    incident: Incident,
    actor: User | undefined,
    type: ActivityType,
    content: string,
    meta?: Record<string, any>,
  ): Promise<void> {
    const activity = this.activityRepo.create({ type, content, meta });
    activity.incident = incident;
    if (actor) activity.actor = actor;
    await this.activityRepo.save(activity);
  }
}
