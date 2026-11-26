import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, ILike, In, Repository } from "typeorm";
import { RequestStatusConfig, RequestStage } from "../request-masters/entities/request-status.entity";
import { ApproverGroup } from "../request-masters/entities/approver-group.entity";
import { RequestPriorityMatrix } from "../request-masters/entities/request-priority-matrix.entity";
import { RequestNotificationRule } from "../request-masters/entities/request-notification-rule.entity";
import { User } from "../users/entities/user.entity";
import { ServiceRequest } from "../requests/entities/request.entity";
import {
  CreateRequestStatusDto, UpdateRequestStatusDto, CreateApproverGroupDto, UpdateApproverGroupDto,
  CreateRequestPriorityMatrixDto, UpdateRequestPriorityMatrixDto, CreateNotificationRuleDto, UpdateNotificationRuleDto,
  NOTIFICATION_EVENTS, NOTIFICATION_RECIPIENTS,
} from "./request-config.dto";

const CLOCK: Record<RequestStage, "running" | "paused" | "stopped"> = {
  approval: "paused", queue: "running", work: "running", hold: "paused", done: "stopped", closed: "stopped", stopped: "stopped",
};

const STAGE_INFO: { key: RequestStage; label: string; hint: string }[] = [
  { key: "approval", label: "Approval", hint: "Waiting for approvers. The SLA clock has not started." },
  { key: "queue", label: "Awaiting assignment", hint: "Approved and waiting for an agent. The SLA clock is running." },
  { key: "work", label: "In progress", hint: "An agent is working on it. Custom statuses can be added here." },
  { key: "hold", label: "On hold", hint: "Waiting on someone else. Custom statuses can be added here." },
  { key: "done", label: "Fulfilled", hint: "Delivered; waiting for the requester to confirm." },
  { key: "closed", label: "Closed", hint: "Confirmed or auto-closed." },
  { key: "stopped", label: "Stopped", hint: "Rejected or cancelled before fulfilment." },
];
const EVENT_LABELS: Record<(typeof NOTIFICATION_EVENTS)[number], string> = {
  submitted: "Request submitted", approvalRequested: "Approval requested", approved: "Request approved", rejected: "Request rejected",
  assigned: "Request assigned", onHold: "Put on hold", fulfilled: "Request fulfilled", reopened: "Request reopened",
  closed: "Request closed", cancelled: "Request cancelled", slaWarning: "SLA breach warning",
};
const RECIPIENT_LABELS: Record<(typeof NOTIFICATION_RECIPIENTS)[number], string> = {
  requester: "Requester", requestedFor: "Requested for", approver: "Approver", assignedAgent: "Assigned agent", workgroup: "Work group", watchers: "Watchers",
};
const MERGE_FIELDS = ["request.number", "request.item", "request.category", "request.priority", "request.status", "request.requestedBy", "request.assignedTo", "request.workgroup", "request.dueDate", "request.holdReason", "approval.stage", "approval.comments", "recipient.name"];

@Injectable()
export class RequestConfigService {
  constructor(
    @InjectRepository(RequestStatusConfig) private statuses: Repository<RequestStatusConfig>,
    @InjectRepository(ApproverGroup) private groups: Repository<ApproverGroup>,
    @InjectRepository(RequestPriorityMatrix) private matrix: Repository<RequestPriorityMatrix>,
    @InjectRepository(RequestNotificationRule) private rules: Repository<RequestNotificationRule>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(ServiceRequest) private requests: Repository<ServiceRequest>,
    private dataSource: DataSource
  ) {}

  // ───────── enumerations the screens need (kept here so the UI holds no lists of its own) ─────────
  stages() { return STAGE_INFO; }
  notificationMeta() {
    return {
      events: NOTIFICATION_EVENTS.map((key) => ({ key, label: EVENT_LABELS[key] })),
      recipients: NOTIFICATION_RECIPIENTS.map((key) => ({ key, label: RECIPIENT_LABELS[key] })),
      mergeFields: MERGE_FIELDS,
    };
  }

  // ───────── request statuses ─────────
  private async statusUsage(s: RequestStatusConfig): Promise<number> {
    return s.isSystem
      ? this.requests.count({ where: { status: s.statusName as ServiceRequest["status"] } })
      : this.requests.count({ where: { subStatus: s.statusName } });
  }

  async listStatuses() {
    const rows = await this.statuses.find({ order: { displayOrder: "ASC", requestStatusId: "ASC" } });
    return Promise.all(rows.map(async (s) => ({ ...s, clock: CLOCK[s.stage], inUse: await this.statusUsage(s) })));
  }

  async createStatus(dto: CreateRequestStatusDto) {
    const name = dto.statusName.trim();
    if (await this.statuses.findOne({ where: { statusName: ILike(name) } })) throw new ConflictException("Another status already uses this name");
    const max = await this.statuses.createQueryBuilder("s").select("MAX(s.displayOrder)", "m").getRawOne<{ m: number | null }>();
    return this.statuses.save(this.statuses.create({
      statusName: name, stage: dto.stage, color: dto.color ?? (dto.stage === "hold" ? "gray" : "violet"),
      description: dto.description?.trim() || null, isActive: dto.isActive ?? true, isSystem: false, displayOrder: (max?.m ?? 0) + 1,
    }));
  }

  async updateStatus(id: number, dto: UpdateRequestStatusDto) {
    const s = await this.statuses.findOne({ where: { requestStatusId: id } });
    if (!s) throw new NotFoundException(`Request status ${id} not found`);
    if (dto.description !== undefined) s.description = dto.description?.trim() || null;
    if (dto.color) s.color = dto.color;
    if (!s.isSystem) {
      if (dto.statusName && dto.statusName.trim() !== s.statusName) {
        const name = dto.statusName.trim();
        const clash = await this.statuses.findOne({ where: { statusName: ILike(name) } });
        if (clash && clash.requestStatusId !== id) throw new ConflictException("Another status already uses this name");
        await this.requests.update({ subStatus: s.statusName }, { subStatus: name });
        s.statusName = name;
      }
      if (dto.stage && dto.stage !== s.stage && (await this.statusUsage(s)) > 0) {
        throw new BadRequestException("This status is in use, so it cannot move to another stage");
      }
      if (dto.stage) s.stage = dto.stage;
      if (dto.isActive !== undefined) s.isActive = dto.isActive;
    }
    return this.statuses.save(s);
  }

  async removeStatus(id: number) {
    const s = await this.statuses.findOne({ where: { requestStatusId: id } });
    if (!s) throw new NotFoundException(`Request status ${id} not found`);
    if (s.isSystem) throw new BadRequestException("System statuses cannot be removed");
    if ((await this.statusUsage(s)) > 0) throw new BadRequestException("This status is on open requests; deactivate it instead");
    await this.statuses.remove(s);
  }

  // ───────── approver groups ─────────
  private async groupUsage(id: number): Promise<string[]> {
    const rows: Array<{ workflow_name: string }> = await this.dataSource.query(
      `SELECT DISTINCT w.workflow_name FROM approval_levels l
         JOIN workflow_steps s ON s.workflow_step_id = l.activity_id
         JOIN workflows w ON w.workflow_id = s.workflow_id
        WHERE l.approver_type = 'group' AND l.approver_id = $1 ORDER BY 1`, [id]);
    return rows.map((r) => r.workflow_name);
  }

  async listGroups() {
    const rows = await this.groups.find({ relations: { members: true }, order: { groupName: "ASC" } });
    return Promise.all(rows.map(async (g) => {
      const usedIn = await this.groupUsage(g.approverGroupId);
      return {
        approverGroupId: g.approverGroupId, groupName: g.groupName, description: g.description ?? null, isActive: g.isActive,
        memberCount: g.members.length, members: g.members.slice(0, 3).map((m) => m.fullName), usedIn,
      };
    }));
  }

  async getGroup(id: number) {
    const g = await this.groups.findOne({ where: { approverGroupId: id }, relations: { members: true } });
    if (!g) throw new NotFoundException(`Approver group ${id} not found`);
    return {
      approverGroupId: g.approverGroupId, groupName: g.groupName, description: g.description ?? null, isActive: g.isActive,
      members: g.members.map((m) => ({ userId: m.userId, fullName: m.fullName, email: m.email, jobTitle: m.jobTitle ?? null })),
      usedIn: await this.groupUsage(id),
    };
  }

  private async membersOf(ids: number[]): Promise<User[]> {
    const unique = [...new Set(ids)];
    if (!unique.length) throw new BadRequestException("Pick at least one member");
    const found = await this.users.find({ where: { userId: In(unique) } });
    if (found.length !== unique.length) throw new BadRequestException("One or more members do not exist");
    return found;
  }

  async createGroup(dto: CreateApproverGroupDto) {
    const name = dto.groupName.trim();
    if (await this.groups.findOne({ where: { groupName: ILike(name) } })) throw new ConflictException("Another group already uses this name");
    const g = await this.groups.save(this.groups.create({
      groupName: name, description: dto.description?.trim() || null, isActive: dto.isActive ?? true, members: await this.membersOf(dto.memberIds),
    }));
    return this.getGroup(g.approverGroupId);
  }

  async updateGroup(id: number, dto: UpdateApproverGroupDto) {
    const g = await this.groups.findOne({ where: { approverGroupId: id }, relations: { members: true } });
    if (!g) throw new NotFoundException(`Approver group ${id} not found`);
    if (dto.groupName && dto.groupName.trim() !== g.groupName) {
      const clash = await this.groups.findOne({ where: { groupName: ILike(dto.groupName.trim()) } });
      if (clash && clash.approverGroupId !== id) throw new ConflictException("Another group already uses this name");
      g.groupName = dto.groupName.trim();
    }
    if (dto.description !== undefined) g.description = dto.description?.trim() || null;
    if (dto.isActive !== undefined) g.isActive = dto.isActive;
    if (dto.memberIds) g.members = await this.membersOf(dto.memberIds);
    await this.groups.save(g);
    return this.getGroup(id);
  }

  async removeGroup(id: number) {
    const g = await this.groups.findOne({ where: { approverGroupId: id } });
    if (!g) throw new NotFoundException(`Approver group ${id} not found`);
    const usedIn = await this.groupUsage(id);
    if (usedIn.length) throw new BadRequestException(`This group is used by ${usedIn.join(", ")}; deactivate it instead`);
    await this.groups.remove(g);
  }

  // ───────── request priority matrix ─────────
  listMatrix() {
    return this.matrix.find({ order: { requestPriorityMatrixId: "ASC" } });
  }
  async createMatrix(dto: CreateRequestPriorityMatrixDto) {
    if (await this.matrix.findOne({ where: { urgencyId: dto.urgencyId, serviceImpactId: dto.serviceImpactId } })) {
      throw new ConflictException("This urgency and impact pair is already mapped");
    }
    const row = await this.matrix.save(this.matrix.create({ ...dto, isActive: dto.isActive ?? true }));
    return this.matrix.findOneOrFail({ where: { requestPriorityMatrixId: row.requestPriorityMatrixId } });
  }
  async updateMatrix(id: number, dto: UpdateRequestPriorityMatrixDto) {
    const row = await this.matrix.findOne({ where: { requestPriorityMatrixId: id } });
    if (!row) throw new NotFoundException(`Matrix row ${id} not found`);
    if (dto.priorityId !== undefined) row.priorityId = dto.priorityId;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    await this.matrix.update({ requestPriorityMatrixId: id }, { priorityId: row.priorityId, isActive: row.isActive });
    return this.matrix.findOneOrFail({ where: { requestPriorityMatrixId: id } });
  }
  async removeMatrix(id: number) {
    const res = await this.matrix.delete({ requestPriorityMatrixId: id });
    if (!res.affected) throw new NotFoundException(`Matrix row ${id} not found`);
  }

  // ───────── e-mail notification rules ─────────
  listRules() {
    return this.rules.find({ order: { displayOrder: "ASC", ruleId: "ASC" } });
  }
  async createRule(dto: CreateNotificationRuleDto) {
    const max = await this.rules.createQueryBuilder("r").select("MAX(r.displayOrder)", "m").getRawOne<{ m: number | null }>();
    return this.rules.save(this.rules.create({ ...dto, isActive: dto.isActive ?? true, displayOrder: dto.displayOrder ?? (max?.m ?? 0) + 1 }));
  }
  async updateRule(id: number, dto: UpdateNotificationRuleDto) {
    const rule = await this.rules.findOne({ where: { ruleId: id } });
    if (!rule) throw new NotFoundException(`Notification rule ${id} not found`);
    Object.assign(rule, dto);
    return this.rules.save(rule);
  }
  async removeRule(id: number) {
    const res = await this.rules.delete({ ruleId: id });
    if (!res.affected) throw new NotFoundException(`Notification rule ${id} not found`);
  }
}
