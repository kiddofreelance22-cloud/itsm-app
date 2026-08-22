import { Injectable, NotFoundException, ForbiddenException, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull, LessThan, Not, In } from "typeorm";
import { Incident } from "./entities/incident.entity";
import { IncidentActivity, ActivityType } from "./entities/incident-activity.entity";
import { Category } from "../categories/entities/category.entity";
import { SubCategory } from "../sub-category/entities/sub-category.entity";
import { User } from "../users/entities/user.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { Location } from "../location/entities/location.entity";
import { ServiceRequest } from "../requests/entities/request.entity";
import { Priority } from "../priority/entities/priority.entity";
import { CreateIncidentDto } from "./dto/create-incident.dto";
import { UpdateIncidentDto } from "./dto/update-incident.dto";

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

  // ── Create ─────────────────────────────────────────────────────────────────
  async create(createdByUserId: number, dto: CreateIncidentDto, actorRoles: string[] = []): Promise<Incident> {
    const createdBy = await this.userRepo.findOne({ where: { userId: createdByUserId } });
    if (!createdBy) throw new NotFoundException(`User ${createdByUserId} not found`);

    const incidentCode = await this.generateIncidentCode();
    const priorityName = dto.priority ?? "Medium";

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
    if (dto.assignmentGroupId && canSetGroup) {
      incident.assignmentGroup = await this.groupRepo.findOne({ where: { groupId: dto.assignmentGroupId } }) || undefined;
    }
    
    // Auto-assign to default group if no assignment group was set
    if (!incident.assignmentGroup) {
      const defaultGroup = await this.groupRepo.findOne({ where: { isDefault: true } });
      if (defaultGroup) {
        incident.assignmentGroup = defaultGroup;
      }
    }

    if (dto.locationId) incident.location = await this.locationRepo.findOne({ where: { locationId: dto.locationId } }) || undefined;
    if (dto.requestId) incident.request = await this.requestRepo.findOne({ where: { requestId: dto.requestId } }) || undefined;
    incident.createdBy = createdBy;

    const saved = await this.repo.save(incident);

    // Log creation activity
    await this.logActivity(saved, createdBy, "created", `Incident ${incidentCode} created.`);

    return this.findOne(saved.incidentId);
  }

  // ── Queue — unassigned incidents for a group ───────────────────────────────
  async getGroupQueue(groupId: number, actorId: number, actorRoles: string[] = []): Promise<Incident[]> {
    const isAdmin = actorRoles.includes("Admin") || actorRoles.includes("Administrator") || actorRoles.includes("Fulfiller");
    if (!isAdmin) {
      const isMember = await this.isGroupMember(groupId, actorId);
      if (!isMember) {
        throw new ForbiddenException("You are not a member of this assignment group.");
      }
    }
    return this.repo.find({
      where: { assignmentGroup: { groupId }, assignedTo: IsNull() },
      relations: INCIDENT_RELATIONS,
      order: { createdAt: "DESC" },
    });
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
    incident.claimedAt = new Date();
    // Response SLA is met if we claimed it before the response target passed.
    incident.slaResponseMet = !incident.slaResponseTarget || incident.claimedAt <= incident.slaResponseTarget;
    const saved = await this.repo.save(incident);

    await this.logActivity(saved, agent, "claimed",
      `Incident claimed and assigned to ${agent.fullName}.`,
      { agentName: agent.fullName }
    );

    return this.findOne(saved.incidentId);
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
    incident.claimedAt = undefined;
    incident.status = "Open";
    const saved = await this.repo.save(incident);

    await this.logActivity(saved, actor ?? undefined, "released",
      `Released back to ${incident.assignmentGroup?.groupName ?? "the group"} queue by ${actor?.fullName ?? "unknown"} (was assigned to ${previousAssignee}).`,
      { releasedBy: actor?.fullName, previousAssignee }
    );

    return this.findOne(saved.incidentId);
  }

  /** Admin/Fulfiller assigns (or reassigns) which group owns this incident. */
  async assignGroup(incidentId: string, groupId: number, actorId?: number): Promise<Incident> {
    const incident = await this.findOne(incidentId);
    const group = await this.groupRepo.findOne({ where: { groupId } });
    if (!group) throw new NotFoundException(`Assignment group ${groupId} not found`);

    const actor = actorId ? await this.userRepo.findOne({ where: { userId: actorId } }) ?? undefined : undefined;
    const prevName = incident.assignmentGroup?.groupName ?? "Unassigned";

    incident.assignmentGroup = group;
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
    const OPEN_STATUSES = ["Open", "Assigned", "In Progress", "On Hold"];

    const result = await this.repo
      .createQueryBuilder()
      .update(Incident)
      .set({ slaBreached: true })
      .where("status IN (:...openStatuses)", { openStatuses: OPEN_STATUSES })
      .andWhere("sla_breached = false")
      .andWhere(
        "((sla_resolution_target IS NOT NULL AND sla_resolution_target < :now) OR " +
          "(claimed_at IS NULL AND sla_response_target IS NOT NULL AND sla_response_target < :now))",
        { now }
      )
      .execute();

    if ((result.affected ?? 0) > 0) {
      this.logger.log(`SLA sweep: marked ${result.affected} incident(s) as breached.`);
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────────
  findAllForUser(userId: number): Promise<Incident[]> {
    return this.repo.find({
      where: [
        { createdBy: { userId } },
        { assignedTo: { userId } },
      ],
      relations: INCIDENT_RELATIONS,
      order: { createdAt: "DESC" },
    });
  }

  findAssignedToUser(userId: number): Promise<Incident[]> {
    return this.repo.find({
      where: { assignedTo: { userId } },
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

  /** Returns all incidents for any group the user is a member of.
   *  Used by Engineers and Service Desk to see their workgroup queue. */
  async findForWorkgroup(userId: number): Promise<Incident[]> {
    // Find all groups the user is a member of
    const groups = await this.groupRepo.find({
      relations: { members: true },
    });
    const userGroupIds = groups
      .filter((g) => g.members?.some((m) => m.userId === userId))
      .map((g) => g.groupId);

    if (userGroupIds.length === 0) {
      // Fallback: show incidents created by or assigned to this user
      return this.findAllForUser(userId);
    }

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
  async update(incidentId: string, dto: UpdateIncidentDto, actorId?: number): Promise<Incident> {
    const incident = await this.findOne(incidentId);
    const actor = actorId ? await this.userRepo.findOne({ where: { userId: actorId } }) || undefined : undefined;

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
    }

    if (dto.priority && dto.priority !== incident.priority) {
      await this.logActivity(incident, actor, "priority_change",
        `Priority changed from ${incident.priority} to ${dto.priority}.`,
        { from: incident.priority, to: dto.priority }
      );
      // Re-target the Response & Resolution SLA against the new priority's
      // configured minutes (still anchored to when the incident was created).
      const newPriorityConfig = await this.priorityRepo.findOne({ where: { priorityName: dto.priority } });
      const responseSlaMinutes = newPriorityConfig?.responseSlaMinutes ?? DEFAULT_RESPONSE_SLA_MINUTES;
      const resolutionSlaMinutes = newPriorityConfig?.resolutionSlaMinutes ?? DEFAULT_RESOLUTION_SLA_MINUTES;
      if (!incident.claimedAt) {
        incident.slaResponseTarget = new Date(incident.createdAt.getTime() + responseSlaMinutes * 60 * 1000);
      }
      if (!incident.resolvedAt) {
        incident.slaResolutionTarget = new Date(incident.createdAt.getTime() + resolutionSlaMinutes * 60 * 1000);
      }
    }

    const { assignedTo, assignmentGroupId, ...rest } = dto as any;
    Object.assign(incident, rest);
    return this.repo.save(incident);
  }

  async remove(incidentId: string): Promise<void> {
    const incident = await this.findOne(incidentId);
    await this.repo.remove(incident);
  }

  // ── Activity / conversation ────────────────────────────────────────────────
  async getActivity(incidentId: string): Promise<IncidentActivity[]> {
    await this.findOne(incidentId);
    return this.activityRepo.find({
      where: { incident: { incidentId } },
      relations: { actor: true },
      order: { createdAt: "ASC" },
    });
  }

  async addComment(
    incidentId: string,
    actorId: number,
    content: string,
    isWorkNote = false,
  ): Promise<IncidentActivity> {
    const incident = await this.findOne(incidentId);
    const actor = await this.userRepo.findOne({ where: { userId: actorId } });
    if (!actor) throw new NotFoundException(`User ${actorId} not found`);
    const activity = this.activityRepo.create({
      type: isWorkNote ? "work_note" : "comment",
      content,
      isWorkNote,
    });
    activity.incident = incident;
    activity.actor = actor;
    return this.activityRepo.save(activity);
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
