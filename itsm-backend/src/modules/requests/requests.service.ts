import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { ServiceRequest } from "./entities/request.entity";
import { RequestVariableValue } from "./entities/request-variable-value.entity";
import { RequestHistory, RequestHistoryAction } from "./entities/request-history.entity";
import { RequestApproval, RequestApproverType } from "./entities/request-approval.entity";
import type { ApprovalRule, ApproveOutcome, CommentPolicy, ParallelApprover, PlanAction, RejectOutcome, TimeoutOutcome } from "../workflows/entities/approval-level.entity";
import { RequestApprovalVote } from "./entities/request-approval-vote.entity";
import { evaluateApprovalRule, type ApprovalDecisionOutcome } from "./approval-rule";
import {
  approvalVoteCounts,
  approvalViewerVote,
  alreadyRespondedConflict,
  assertNoPriorApprovalVote,
  canActOnPendingApproval,
  uniqueParallelVoteSlots,
} from "./approval-vote-utils";
import { postJson } from "./outbound-webhook";
import { RequestTask } from "./entities/request-task.entity";
import { Catalog } from "../catalogs/entities/catalog.entity";
import { CatalogVariable } from "../catalogs/entities/catalog-variable.entity";
import { User } from "../users/entities/user.entity";
import { WorkflowStep } from "../workflows/entities/workflow-step.entity";
import { WorkflowTask } from "../workflows/entities/workflow-task.entity";
import { ApprovalLevel } from "../workflows/entities/approval-level.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { ApproverGroup } from "../request-masters/entities/approver-group.entity";
import { RequestPendingReason } from "../request-masters/entities/request-pending-reason.entity";
import { RequestLink } from "./entities/request-link.entity";
import { WorkOrder } from "../itsm-config/entities/work-order.entity";
import { ClosureCode } from "../request-masters/entities/closure-code.entity";
import { RequestStatusConfig } from "../request-masters/entities/request-status.entity";
import { ServiceUrgency } from "../service-urgencies/entities/service-urgency.entity";
import { ServiceImpact } from "../service-impacts/entities/service-impact.entity";
import { ServicePriority } from "../service-priorities/entities/service-priority.entity";
import { WorkflowsService, workflowConditionValues } from "../workflows/workflows.service";
import { RolesService } from "../roles/roles.service";
import { CreateRequestDto } from "./dto/create-request.dto";
import { UpdateRequestDto } from "./dto/update-request.dto";
import {
  AssignRequestDto, HoldRequestDto, FulfilRequestDto, ClassifyRequestDto, RequestQueueQueryDto,
} from "./dto/request-lifecycle.dto";
import { RequestSlaService, SlaState } from "./request-sla.service";
import { RequestNotifier } from "./request-notifier.service";

export interface Actor { userId: number; roles: string[] }
export type RequestView = ServiceRequest & {
  sla: { state: SlaState; responseTarget: Date | null; fulfilmentTarget: Date | null; pausedAt: Date | null };
};

interface PlanLevel {
  stepOrder: number; levelNumber: number; title: string;
  approverType: RequestApproverType; approverRef: number | null; autoApproval: boolean;
  sourceLevelId?: number | null; onReject?: RejectOutcome; rejectArg?: string | null;
  approvalRule?: ApprovalRule; approvers?: ParallelApprover[] | null;
  onApprove?: ApproveOutcome; approveArg?: string | null; afterActions?: PlanAction[];
  commentPolicy?: CommentPolicy; allowReject?: boolean; allowInfo?: boolean; allowDelegate?: boolean;
  remindDays?: number; timeoutDays?: number; onTimeout?: TimeoutOutcome; timeoutArg?: string | null;
}

const controlsOf = (l: { commentPolicy?: CommentPolicy; allowReject?: boolean; allowInfo?: boolean; allowDelegate?: boolean; remindDays?: number; timeoutDays?: number; onTimeout?: TimeoutOutcome; timeoutArg?: string | null }) => ({
  commentPolicy: l.commentPolicy ?? "reject", allowReject: l.allowReject ?? true, allowInfo: l.allowInfo ?? true, allowDelegate: l.allowDelegate ?? false,
  remindDays: l.remindDays ?? 0, timeoutDays: l.timeoutDays ?? 0, onTimeout: l.onTimeout ?? "escalate", timeoutArg: l.timeoutArg ?? null,
});
/** The moment N business days (Mon to Fri) after `from`, keeping the time of day. */
const addBusinessDays = (from: Date, days: number): Date => {
  const d = new Date(from); let left = Math.max(0, Math.round(days));
  while (left > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) left--; }
  return d;
};
const weekdaysSince = (from: Date, now = new Date()): number => {
  let n = 0; const d = new Date(from);
  for (d.setDate(d.getDate() + 1); d.getTime() <= now.getTime(); d.setDate(d.getDate() + 1)) if (d.getDay() !== 0 && d.getDay() !== 6) n++;
  return n;
};
interface PlanTask {
  workflowTaskId: number; taskName: string; description?: string;
  assigneeType?: "user" | "group" | "role"; assigneeId?: number; priority: string; dueHours?: number; sortOrder: number;
}

const OPEN_STATUSES = ["Pending Approval", "Approved", "In Progress", "On Hold", "Fulfilled"];
const TERMINAL = ["Closed", "Rejected", "Cancelled"];

const REQUEST_RELATIONS = {
  catalog: {
    workflow: { approverRole: true }, category: true, serviceCategory: true,
    urgency: true, serviceImpact: true, priority: true, fulfillmentGroup: true, assignmentGroup: true,
  },
  requestedBy: true, submittedBy: true, currentStep: { approverRole: true },
  variableValues: { variable: true },
  approvals: { actedBy: true }, tasks: { completedBy: true },
  urgency: true, serviceImpact: true, priority: true,
  assignmentGroup: true, assignedTo: true, pendingReason: true, closureCode: true,
} as const;

import { isStaff } from "../../common/utils/roles.util";

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    @InjectRepository(ServiceRequest) private requestsRepo: Repository<ServiceRequest>,
    @InjectRepository(RequestVariableValue) private valuesRepo: Repository<RequestVariableValue>,
    @InjectRepository(RequestHistory) private historyRepo: Repository<RequestHistory>,
    @InjectRepository(RequestApproval) private approvalsRepo: Repository<RequestApproval>,
    @InjectRepository(RequestApprovalVote) private votesRepo: Repository<RequestApprovalVote>,
    @InjectRepository(RequestTask) private tasksRepo: Repository<RequestTask>,
    @InjectRepository(Catalog) private catalogsRepo: Repository<Catalog>,
    @InjectRepository(CatalogVariable) private catalogVariablesRepo: Repository<CatalogVariable>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(ApprovalLevel) private levelsRepo: Repository<ApprovalLevel>,
    @InjectRepository(WorkflowTask) private workflowTasksRepo: Repository<WorkflowTask>,
    @InjectRepository(AssignmentGroup) private groupsRepo: Repository<AssignmentGroup>,
    @InjectRepository(ApproverGroup) private approverGroupsRepo: Repository<ApproverGroup>,
    @InjectRepository(RequestPendingReason) private pendingReasonsRepo: Repository<RequestPendingReason>,
    @InjectRepository(RequestLink) private linksRepo: Repository<RequestLink>,
    @InjectRepository(WorkOrder) private workOrdersRepo: Repository<WorkOrder>,
    @InjectRepository(ClosureCode) private closureCodesRepo: Repository<ClosureCode>,
    @InjectRepository(RequestStatusConfig) private statusConfigRepo: Repository<RequestStatusConfig>,
    @InjectRepository(ServiceUrgency) private urgenciesRepo: Repository<ServiceUrgency>,
    @InjectRepository(ServiceImpact) private serviceImpactsRepo: Repository<ServiceImpact>,
    @InjectRepository(ServicePriority) private prioritiesRepo: Repository<ServicePriority>,
    private dataSource: DataSource,
    private workflowsService: WorkflowsService,
    private rolesService: RolesService,
    private sla: RequestSlaService,
    private notifier: RequestNotifier
  ) {}

  // ───────────────────────── helpers ─────────────────────────

  private isAdmin = (a: Actor) => (a.roles ?? []).some((r) => ["Admin", "ADMIN", "Administrator"].includes(r));
  private isAgent = (a: Actor) => this.isAdmin(a) || isStaff(a.roles);

  private async timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const t = Date.now();
    try { return await fn(); }
    finally { this.logger.log(`[submit] ${label}: ${Date.now() - t}ms`); }
  }

  /**
   * Checks what the requester typed against the rules set on each catalog field: number limits, whole numbers, date
   * limits, no past dates, maximum length and the pattern. Empty values are left to the required-field check.
   */
  private checkFieldRules(catalogVariables: CatalogVariable[], values: { variableId: number; value: string }[]): void {
    const today = new Date().toISOString().slice(0, 10);
    const problems: string[] = [];
    for (const vv of values) {
      const v = catalogVariables.find((c) => c.variableId === vv.variableId);
      const raw = (vv.value ?? "").trim();
      if (!v || !raw) continue;
      const bad = (text: string) => problems.push(`${v.label}: ${text}`);
      if (v.fieldType === "number") {
        const n = Number(raw);
        if (!Number.isFinite(n)) { bad("enter a number"); continue; }
        if (v.onlyIntegers && !Number.isInteger(n)) bad("enter a whole number");
        if (v.minValue != null && v.minValue !== "" && n < Number(v.minValue)) bad(`must be at least ${v.minValue}`);
        if (v.maxValue != null && v.maxValue !== "" && n > Number(v.maxValue)) bad(`must be at most ${v.maxValue}`);
      } else if (v.fieldType === "date" || v.fieldType === "datetime") {
        const day = raw.slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) { bad("enter a valid date"); continue; }
        if (v.noPastDates && day < today) bad("the date cannot be in the past");
        if (v.dateMin && day < String(v.dateMin).slice(0, 10)) bad(`the date cannot be before ${String(v.dateMin).slice(0, 10)}`);
        if (v.dateMax && day > String(v.dateMax).slice(0, 10)) bad(`the date cannot be after ${String(v.dateMax).slice(0, 10)}`);
      } else if (v.fieldType === "text" || v.fieldType === "textarea") {
        if (v.maxLength && raw.length > v.maxLength) bad(`must be ${v.maxLength} characters or fewer`);
        if (v.validationRegex) {
          let re: RegExp | null = null;
          try { re = new RegExp(v.validationRegex); } catch { re = null; } // an invalid pattern set by an admin must not block every request
          if (re && !re.test(raw)) bad("does not match the expected format");
        }
      }
    }
    if (problems.length) throw new BadRequestException(problems.join("; "));
  }

  /** Raising a request for someone else is on unless ALLOW_REQUEST_FOR_OTHERS=false. */
  assertMayRequestForOthers(): void {
    if (process.env.ALLOW_REQUEST_FOR_OTHERS === "false") throw new ForbiddenException("Requests can only be raised for yourself");
  }

  private async approverName(type: RequestApproverType | string, ref: number | null | undefined): Promise<string> {
    if (type === "requester_manager") return "Requester's manager";
    const q: Record<string, [string, string, string]> = { user: ["users", "user_id", "full_name"], group: ["approver_groups", "approver_group_id", "group_name"], role: ["roles", "role_id", "role_name"], custom: ["assignment_groups", "group_id", "group_name"] };
    const t = q[type];
    if (!t || ref == null) return "Approver";
    const r = await this.requestsRepo.manager.query(`select ${t[2]} as n from ${t[0]} where ${t[1]} = $1`, [ref]);
    return r[0]?.n ?? "Approver";
  }

  /** What would happen to a request with these answers, using the same rules as submitting it. Nothing is saved. */
  async previewPath(catalogId: number, variableValues: { variableId: number; value: string }[]) {
    const catalog = await this.catalogsRepo.findOne({ where: { catalogId }, relations: REQUEST_RELATIONS.catalog });
    if (!catalog) throw new NotFoundException(`Catalog ${catalogId} not found`);
    const catalogVariables = await this.catalogVariablesRepo.find({ where: { catalog: { catalogId } } });
    const variables = variableValues.map((vv) => ({ label: catalogVariables.find((c) => c.variableId === vv.variableId)?.label ?? "", value: vv.value }));
    const plan = await this.buildPlan(catalog, variables);
    const approvals: { title: string; approver: string; rule: string | null }[] = [];
    for (const l of plan.levels.filter((x) => !x.autoApproval)) {
      let approver = await this.approverName(l.approverType, l.approverRef);
      if (l.approverType === "parallel") approver = (await Promise.all((l.approvers ?? []).map((a) => this.approverName(a.type, a.ref)))).join(", ");
      const rule = l.approvalRule && l.approvalRule !== "any" ? (l.approvalRule === "all" ? "Everyone must approve" : "A majority must approve") : null;
      approvals.push({ title: l.title, approver, rule });
    }
    return {
      approvals,
      fulfilmentGroup: catalog.fulfillmentGroup?.groupName ?? catalog.assignmentGroup?.groupName ?? null,
      deliveryDays: Number(catalog.deliveryTimeSla ?? catalog.estimatedTime) || null,
      tasks: plan.tasks.length,
    };
  }

  /** Validates a chat request draft with the same catalog field rules used by submission. */
  async validateChatDraft(catalogId: number, variableValues: { variableId: number; value: string }[]) {
    const catalog = await this.catalogsRepo.findOne({
      where: { catalogId, isActive: true, status: "published" },
      relations: REQUEST_RELATIONS.catalog,
    });
    if (!catalog) throw new NotFoundException(`Published catalog item ${catalogId} not found`);
    const variables = await this.catalogVariablesRepo.find({
      where: { catalog: { catalogId }, isActive: true, isVisible: true },
      order: { sortOrder: "ASC", variableId: "ASC" },
    });
    const validIds = new Set(variables.map((item) => item.variableId));
    for (const value of variableValues) {
      if (!validIds.has(value.variableId)) {
        throw new BadRequestException(`Variable ${value.variableId} does not belong to catalog ${catalogId}`);
      }
    }
    const seen = new Set<number>();
    for (const value of variableValues) {
      if (seen.has(value.variableId)) throw new BadRequestException(`Variable ${value.variableId} was submitted more than once`);
      seen.add(value.variableId);
    }
    this.checkFieldRules(variables, variableValues);
    const missingFields = variables
      .filter((item) => item.isMandatory && !variableValues.some((value) => value.variableId === item.variableId && value.value.trim()))
      .map((item) => ({ variableId: item.variableId, label: item.label, fieldType: item.fieldType, helpText: item.helpText }));
    const preview = missingFields.length
      ? null
      : await this.previewPath(catalogId, variableValues);
    return {
      catalog: { catalogId: catalog.catalogId, name: catalog.catalogName },
      variables: variables.map((item) => ({
        variableId: item.variableId,
        label: item.label,
        fieldType: item.fieldType,
        required: item.isMandatory,
        helpText: item.helpText,
      })),
      missingFields,
      preview,
    };
  }

  /** For the links / work-notes service: only fulfilment agents and admins may use them. */
  assertAgentAccess(a: Actor): void { this.assertAgent(a); }

  /** Adds an entry to the request's history on behalf of another service. */
  async logUpdate(requestId: number, actorId: number | null, text: string): Promise<void> {
    const request = await this.findOne(requestId);
    await this.log(request, "Updated", actorId, text);
  }

  private assertAgent(a: Actor) {
    if (!this.isAgent(a)) throw new ForbiddenException("Only fulfilment agents can do this");
  }
  private assertStatus(request: ServiceRequest, allowed: string[], what: string) {
    if (!allowed.includes(request.status)) {
      throw new BadRequestException(`Cannot ${what}: the request is ${request.status}`);
    }
  }
  private async actorUser(a: Actor): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { userId: a.userId } });
    if (!user) throw new NotFoundException(`User ${a.userId} not found`);
    return user;
  }
  private async log(
    request: ServiceRequest, action: RequestHistoryAction, actorId: number | null, comments?: string | null
  ): Promise<void> {
    const entry = this.historyRepo.create({ action, comments: comments ?? undefined, actionBy: actorId == null ? null : ({ userId: actorId } as User) });
    entry.request = request;
    await this.historyRepo.save(entry);
  }

  private present(request: ServiceRequest): RequestView {
    if (request.approvals) {
      request.approvals = this.sortedApprovals(request);
    }
    return Object.assign(request, {
      sla: {
        state: this.sla.state(request),
        responseTarget: request.slaResponseTarget ?? null,
        fulfilmentTarget: request.slaFulfilmentTarget ?? null,
        pausedAt: request.slaPausedAt ?? null,
      },
    });
  }

  private sortedApprovals(request: ServiceRequest): RequestApproval[] {
    return [...(request.approvals ?? [])].sort((a, b) => a.levelNumber - b.levelNumber);
  }

  /** Refresh active requests whose stored fulfilment deadline predates priority-based SLA calculation. */
  private async refreshPrioritySla(request: ServiceRequest): Promise<void> {
    if (
      !request.slaStartedAt ||
      request.slaPausedAt ||
      !["Approved", "In Progress"].includes(request.status) ||
      !request.priority?.resolutionSlaMinutes ||
      request.priority.resolutionSlaMinutes <= 0
    ) return;

    const previousTarget = request.slaFulfilmentTarget?.getTime() ?? null;
    await this.sla.recompute(request, request.catalog);
    if ((request.slaFulfilmentTarget?.getTime() ?? null) !== previousTarget) {
      await this.requestsRepo.save(request);
    }
  }

  pendingLevel(request: ServiceRequest): RequestApproval | undefined {
    return this.sortedApprovals(request).find((a) => a.status === "Pending");
  }

  /** Users who may act on an approval level. */
  async resolveApproverUsers(level: { approverType: RequestApproverType; approverRef?: number | null }, request?: ServiceRequest): Promise<User[]> {
    // Resolved per request from the requester's own profile, so there is no fixed approver id.
    if (level.approverType === "requester_manager") return this.resolveRequesterManager(request);
    if (level.approverType === "parallel") {
      const seen = new Map<number, User>();
      for (const slot of await this.slotsFor(level as RequestApproval, request)) for (const u of slot.users) seen.set(u.userId, u);
      return [...seen.values()];
    }
    const ref = level.approverRef ?? null;
    if (ref === null) return [];
    if (level.approverType === "user") {
      const u = await this.usersRepo.findOne({ where: { userId: ref, isActive: true } });
      return u ? [u] : [];
    }
    if (level.approverType === "role") {
      const ids = (await this.rolesService.getUsersForRole(ref)).map((u) => u.userId);
      return ids.length ? this.usersRepo.find({ where: { userId: In(ids), isActive: true } }) : [];
    }
    if (level.approverType === "group") {
      const g = await this.approverGroupsRepo.findOne({ where: { approverGroupId: ref }, relations: { members: true } });
      return g?.isActive === false ? [] : (g?.members ?? []).filter((u) => u.isActive !== false);
    }
    const g = await this.groupsRepo.findOne({ where: { groupId: ref }, relations: { members: true } });
    return g?.isActive === false ? [] : (g?.members ?? []).filter((u) => u.isActive !== false);
  }

  /**
   * The reporting manager on the requester's profile. The profile stores the manager as a name
   * (or the directory-synced value), so it is matched against name, display name, username and e-mail.
   */
  private async resolveRequesterManager(request?: ServiceRequest): Promise<User[]> {
    let requester = request?.requestedBy;
    // Check if request is on behalf of another user via form variable (e.g. requested_for / user)
    const targetVar = request?.variableValues?.find((v) =>
      ["requested for", "requested_for", "user", "employee", "on behalf of"].includes(v.variable?.label?.toLowerCase()?.trim() || "")
    );
    if (targetVar?.value?.trim()) {
      const val = targetVar.value.trim();
      const isNum = /^\d+$/.test(val);
      const targetUser = await this.usersRepo.findOne({
        where: [
          ...(isNum ? [{ userId: Number(val) }] : []),
          { fullName: val },
          { email: val },
          { username: val },
        ],
      });
      if (targetUser?.managerName?.trim()) {
        requester = targetUser;
      }
    }

    const raw = requester?.managerName?.trim();
    if (!requester || !raw) return [];
    const isNum = /^\d+$/.test(raw);
    return this.usersRepo.createQueryBuilder("u")
      .where("u.isActive = true")
      .andWhere(
        isNum
          ? "(u.userId = :userId OR LOWER(u.fullName) = LOWER(:m) OR LOWER(u.displayName) = LOWER(:m) OR LOWER(u.username) = LOWER(:m) OR LOWER(u.email) = LOWER(:m))"
          : "(LOWER(u.fullName) = LOWER(:m) OR LOWER(u.displayName) = LOWER(:m) OR LOWER(u.username) = LOWER(:m) OR LOWER(u.email) = LOWER(:m))",
        { m: raw, userId: isNum ? Number(raw) : -1 }
      )
      .getMany();
  }

  /** Each eligible user gets one slot, including users repeated across parallel approver entries. */
  async slotsFor(level: { approverType: RequestApproverType; approverRef?: number | null; approvalRule?: ApprovalRule; approvers?: ParallelApprover[] | null }, request?: ServiceRequest): Promise<{ slot: string; users: User[] }[]> {
    if (level.approverType === "parallel") {
      const out: { slot: string; users: User[] }[] = [];
      for (const [i, a] of (level.approvers ?? []).entries()) {
        const users = await this.resolveApproverUsers({ approverType: a.type, approverRef: a.ref ?? null }, request);
        out.push({
          slot: `e:${i}`,
          users: users.filter((user) => user.isActive !== false
            && !this.isRequestOwner(request, { userId: user.userId, roles: [] })),
        });
      }
      return uniqueParallelVoteSlots(out.filter((slot) => slot.users.length > 0));
    }
    return (await this.resolveApproverUsers(level, request))
      .filter((u) => u.isActive !== false && !this.isRequestOwner(request, { userId: u.userId, roles: [] }))
      .map((u) => ({ slot: `u:${u.userId}`, users: [u] }));
  }

  private async ensureVoteSlots(level: RequestApproval, slots: { slot: string; users: User[] }[]): Promise<void> {
    const individualSlots = slots.filter((slot) => slot.users.length === 1);
    if (!individualSlots.length) return;
    const existing = await this.votesRepo.find({ where: { approval: { requestApprovalId: level.requestApprovalId } } });
    const known = new Set(existing.map((vote) => vote.slot));
    const missing = individualSlots.filter((slot) => !known.has(slot.slot));
    if (!missing.length) return;
    await this.votesRepo.createQueryBuilder()
      .insert()
      .values(missing.map((slot) => ({
        approval: { requestApprovalId: level.requestApprovalId },
        slot: slot.slot,
        user: { userId: slot.users[0].userId },
        decision: "Pending" as const,
      })))
      .orIgnore()
      .execute();
  }

  /** The requester, and anyone who raised the request on their behalf (an admin, say), never decides its approvals. */
  private isRequestOwner(request: ServiceRequest | undefined, actor: Actor): boolean {
    return !!request && (request.requestedBy?.userId === actor.userId || request.submittedBy?.userId === actor.userId);
  }

  /**
   * Only the people the level names can act on it. Being an administrator does not make someone an approver:
   * an admin sees (and decides) an approval only when the level is actually theirs.
   */
  async canActOnLevel(actor: Actor, level: RequestApproval, request?: ServiceRequest): Promise<boolean> {
    if (this.isRequestOwner(request, actor)) return false;
    const users = await this.resolveApproverUsers(level, request);
    if (!users.some((u) => u.userId === actor.userId && u.isActive !== false)) return false;
    if (level.status === "Pending") {
      const slots = await this.slotsFor(level, request);
      if (slots.length) {
        const votes = await this.votesRepo.find({
          where: { approval: { requestApprovalId: level.requestApprovalId } },
          relations: { user: true },
        });
        const taken = new Set(votes
          .filter((vote) => vote.decision === "Approved" || vote.decision === "Rejected" || vote.decision === "Cancelled")
          .map((vote) => vote.slot));
        const eligibleSlot = slots.find((slot) => slot.users.some((user) => user.userId === actor.userId));
        const hasResponded = votes.some(
          (vote) =>
            vote.user?.userId === actor.userId &&
            (vote.decision === "Approved" || vote.decision === "Rejected"),
        );
        return canActOnPendingApproval(
          !!eligibleSlot,
          !!eligibleSlot && !taken.has(eligibleSlot.slot),
          hasResponded,
        );
      }
      return false;
    }
    return true;
  }

  private async clearVotes(level: RequestApproval): Promise<void> {
    await this.votesRepo.createQueryBuilder().delete().where("request_approval_id = :id", { id: level.requestApprovalId }).execute();
  }

  private async assertCanView(request: ServiceRequest, actor: Actor): Promise<void> {
    if (this.isAgent(actor)) return;
    if (request.requestedBy?.userId === actor.userId || request.submittedBy?.userId === actor.userId) return;
    for (const level of request.approvals ?? []) {
      if (level.actedBy?.userId === actor.userId) return;
      if (await this.votesRepo.findOne({
        where: { approval: { requestApprovalId: level.requestApprovalId }, user: { userId: actor.userId } },
      })) return;
      if (await this.canActOnLevel(actor, level, request)) return;
    }
    throw new ForbiddenException("You do not have access to this request");
  }

  // ───────────────────── workflow planning ─────────────────────

  /**
   * Walks the catalog's workflow once: approval steps become sequential approval levels,
   * task steps become fulfilment tasks. (Approvals are all collected before fulfilment starts.)
   */
  private async buildPlan(catalog: Catalog, variables: { label: string; value: string }[]): Promise<{ levels: PlanLevel[]; tasks: PlanTask[]; initialActions: PlanAction[] }> {
    const levels: PlanLevel[] = [];
    const initialActions: PlanAction[] = [];
    const tasks: PlanTask[] = [];
    const wf = catalog.workflow;
    if (!wf) return { levels, tasks, initialActions };
    const conditionValues = workflowConditionValues(variables, catalog.estimatedCost);
    const graph = await this.workflowsService.loadGraph(wf.workflowId);
    const approvalStepIds = graph.steps.filter((step) => step.stepType === "approval").map((step) => step.workflowStepId);
    const taskStepIds = graph.steps.filter((step) => step.stepType === "task").map((step) => step.workflowStepId);
    const [workflowLevels, workflowTasks] = await Promise.all([
      approvalStepIds.length
        ? this.levelsRepo.find({
          where: { activity: { workflowStepId: In(approvalStepIds) } },
          relations: { customGroup: true, activity: true },
          order: { levelNumber: "ASC" },
        })
        : Promise.resolve([]),
      taskStepIds.length
        ? this.workflowTasksRepo.find({
          where: { activity: { workflowStepId: In(taskStepIds) } },
          relations: { activity: true },
          order: { workflowTaskId: "ASC" },
        })
        : Promise.resolve([]),
    ]);
    let n = 0;
    if (wf.requiresApproval) {
      levels.push({ stepOrder: 0, levelNumber: ++n, title: "Workflow approval", approverType: "role", approverRef: wf.approverRole?.roleId ?? null, autoApproval: false });
    }
    let step = await this.workflowsService.getFirstStep(wf.workflowId, conditionValues, graph);
    for (let guard = 0; step && guard < 100; guard++) {
      const stepId = step.workflowStepId;
      if (step.stepType === "approval") {
        const lv = workflowLevels.filter((level) => level.activity.workflowStepId === stepId);
        if (lv.length) {
          for (const l of lv) {
            levels.push({
              stepOrder: step.stepOrder, levelNumber: ++n, title: l.title || step.stepName,
              approverType: l.approverType,
              approverRef: l.approverType === "custom" ? l.customGroup?.groupId ?? null : l.approverId ?? null,
              autoApproval: l.autoApproval,
              sourceLevelId: l.approvalLevelId, onReject: l.onReject ?? "close", rejectArg: l.rejectArg ?? null,
              approvalRule: l.approvalRule ?? "any", approvers: l.approvers ?? null,
              onApprove: l.onApprove ?? "next", approveArg: l.approveArg ?? null, afterActions: [], ...controlsOf(l),
            });
          }
        } else if (step.approverRole) {
          levels.push({ stepOrder: step.stepOrder, levelNumber: ++n, title: step.stepName, approverType: "role", approverRef: step.approverRole.roleId, autoApproval: false });
        }
      } else if (step.stepType === "wait" || step.stepType === "record" || step.stepType === "integration") {
        const cfg = (step.config ?? {}) as Record<string, unknown>;
        let action: PlanAction | null = null;
        if (step.stepType === "wait" && Number(cfg.days) >= 1) action = { type: "wait", days: Math.min(365, Math.round(Number(cfg.days))) };
        if (step.stepType === "record" && ["incident", "change", "problem", "work_order", "request"].includes(String(cfg.recordType)) && String(cfg.title ?? "").trim()) {
          action = {
            type: "record", recordType: cfg.recordType as "incident" | "change" | "problem" | "work_order" | "request",
            title: String(cfg.title).trim(), description: cfg.description ? String(cfg.description) : undefined,
            priority: cfg.priority ? String(cfg.priority) : undefined,
            priorityId: Number(cfg.priorityId) || undefined, catalogId: Number(cfg.catalogId) || undefined,
          };
        }
        if (step.stepType === "integration" && (cfg.kind === "webhook" || cfg.kind === "teams") && String(cfg.url ?? "").trim()) {
          action = { type: "integration", kind: cfg.kind, url: String(cfg.url).trim(), secret: cfg.secret ? String(cfg.secret) : undefined, name: step.stepName };
        }
        if (action) (levels.length ? (levels[levels.length - 1].afterActions ??= []) : initialActions).push(action);
      } else if (step.stepType === "notification" || step.stepType === "update") {
        // E-mail and update-request steps run when the approval before them is approved (or at submit when none precedes them).
        const cfg = (step.config ?? {}) as Record<string, unknown>;
        let action: PlanAction | null = null;
        if (step.stepType === "notification" && Number(cfg.ruleId)) action = { type: "email", ruleId: Number(cfg.ruleId), to: Array.isArray(cfg.to) ? (cfg.to as string[]) : ["requester"] };
        if (step.stepType === "update" && ["priority", "assignmentGroup", "agent"].includes(String(cfg.field)) && Number(cfg.value)) action = { type: "update", field: cfg.field as "priority", value: Number(cfg.value) };
        if (action) (levels.length ? (levels[levels.length - 1].afterActions ??= []) : initialActions).push(action);
      } else if (step.stepType === "task") {
        const wt = workflowTasks.filter((task) => task.activity.workflowStepId === stepId);
        for (const t of wt) {
          tasks.push({
            workflowTaskId: t.workflowTaskId, taskName: t.taskName, description: t.description ?? undefined,
            assigneeType: t.assigneeType as PlanTask["assigneeType"], assigneeId: t.assigneeId ?? undefined,
            priority: t.priority, dueHours: t.dueDateHours ?? undefined, sortOrder: tasks.length + 1,
          });
        }
      }
      step = await this.workflowsService.getNextStep(wf.workflowId, step.stepOrder, conditionValues, graph);
    }
    return { levels, tasks, initialActions };
  }

  private variablesOf(request: ServiceRequest) {
    return (request.variableValues ?? []).map((v) => ({ label: v.variable.label, value: v.value }));
  }

  /** Requests that were in an approval step before this lifecycle existed have no approval rows yet. */
  private async ensureApprovalRows(request: ServiceRequest): Promise<ServiceRequest> {
    if (request.status !== "Pending Approval" || (request.approvals ?? []).length) return request;
    const plan = await this.buildPlan(request.catalog, this.variablesOf(request));
    const currentOrder = request.currentStep?.stepOrder ?? 0;
    const rows = plan.levels.map((l) => this.approvalsRepo.create({
      request, levelNumber: l.levelNumber, title: l.title, approverType: l.approverType, approverRef: l.approverRef,
      onReject: l.onReject ?? "close", rejectArg: l.rejectArg ?? null, sourceLevelId: l.sourceLevelId ?? null,
      approvalRule: l.approvalRule ?? "any", approvers: l.approvers ?? null,
      onApprove: l.onApprove ?? "next", approveArg: l.approveArg ?? null, afterActions: l.afterActions ?? null, ...controlsOf(l),
      status: l.stepOrder < currentOrder ? "Approved" : "Pending",
      comments: l.stepOrder < currentOrder ? "Approved before the lifecycle upgrade" : undefined,
      actedAt: l.stepOrder < currentOrder ? new Date() : undefined,
    }));
    if (rows.length) await this.approvalsRepo.save(rows);
    return this.findOne(request.requestId);
  }

  private async instantiateTasks(request: ServiceRequest): Promise<void> {
    if ((request.tasks ?? []).length) return;
    const plan = await this.buildPlan(request.catalog, this.variablesOf(request));
    if (!plan.tasks.length) return;
    const now = Date.now();
    await this.tasksRepo.save(plan.tasks.map((t) => this.tasksRepo.create({
      request, workflowTaskId: t.workflowTaskId, taskName: t.taskName, description: t.description,
      assigneeType: t.assigneeType, assigneeId: t.assigneeId, priority: t.priority, sortOrder: t.sortOrder,
      dueAt: t.dueHours ? new Date(now + t.dueHours * 3600_000) : undefined,
    })));
  }

  /** All approvals are in: the request waits in the agent queue and the SLA clock starts. */
  private async enterQueue(request: ServiceRequest): Promise<void> {
    request.status = "Approved";
    request.currentStep = undefined;
    request.assignmentGroup = request.assignmentGroup ?? request.catalog.fulfillmentGroup ?? request.catalog.assignmentGroup ?? null;
    await this.sla.startClock(request, request.catalog);
    // Route to a person, not just a queue: the least-loaded active member of the fulfilment group.
    if (!request.assignedTo && request.assignmentGroup) {
      const group = await this.groupsRepo.findOne({ where: { groupId: request.assignmentGroup.groupId }, relations: { members: true } });
      const members = (group?.members ?? []).filter((m) => m.isActive);
      if (members.length) {
        const load = await Promise.all(members.map(async (m) => ({
          m, n: await this.requestsRepo.count({ where: { assignedTo: { userId: m.userId }, status: In(["Approved", "In Progress", "On Hold"]) } }),
        })));
        request.assignedTo = load.sort((a, b) => a.n - b.n)[0].m;
      }
    }
    await this.requestsRepo.save(request);
    await this.instantiateTasks(request);
  }

  /** After approvals change: either the next level is waiting, or the request moves to the queue. */
  private async settleApprovals(requestId: number): Promise<ServiceRequest> {
    let request = await this.findOne(requestId);
    if (request.status === "Fulfilled" || request.status === "Waiting") return request; // finished by "fulfil automatically", or paused by a Wait step
    const pending = this.pendingLevel(request);
    if (pending) {
      const slots = await this.slotsFor(pending, request);
      if (!slots.length && pending.approverType !== "requester_manager") {
        pending.status = "Rejected";
        pending.actedAt = new Date();
        pending.comments = "No active approvers are available";
        await this.approvalsRepo.save(pending);
        await this.log(request, "Rejected", null, `${pending.title}: no active approvers are available`);
        return this.routeRejection(request, pending, null, "No active approvers are available");
      }
      if (!pending.pendingSince) { pending.pendingSince = new Date(); pending.remindedAt = null; await this.approvalsRepo.save(pending); }
      await this.ensureVoteSlots(pending, slots);
      request.status = "Pending Approval";
      await this.requestsRepo.save(request);
      request = await this.findOne(requestId);
      await this.timed("approvalRequested notification", async () => this.notifier.notify("approvalRequested", request, {
        approvers: (await this.resolveApproverUsers(pending, request)).filter((u) => !this.isRequestOwner(request, { userId: u.userId, roles: [] })),
        approvalStage: pending.title,
      }));
      return request;
    }
    await this.enterQueue(request);
    return this.findOne(requestId);
  }

  // ───────────────────────── create / edit ─────────────────────────

  async create(requestedByUserId: number, dto: CreateRequestDto, submittedByUserId = requestedByUserId, systemGenerated = false): Promise<RequestView> {
    const createStartedAt = Date.now();
    try {
    const catalog = await this.catalogsRepo.findOne({
      where: { catalogId: dto.catalogId }, relations: REQUEST_RELATIONS.catalog,
    });
    if (!catalog) throw new NotFoundException(`Catalog ${dto.catalogId} not found`);

    const requestedBy = await this.usersRepo.findOne({ where: { userId: requestedByUserId } });
    if (!requestedBy) throw new NotFoundException(`User ${requestedByUserId} not found`);
    const submittedBy = submittedByUserId === requestedByUserId
      ? requestedBy : await this.usersRepo.findOne({ where: { userId: submittedByUserId } });
    if (!submittedBy) throw new NotFoundException(`User ${submittedByUserId} not found`);

    const catalogVariables = await this.catalogVariablesRepo.find({ where: { catalog: { catalogId: dto.catalogId } } });
    const validVariableIds = new Set(catalogVariables.map((v) => v.variableId));
    for (const vv of dto.variableValues) {
      if (!validVariableIds.has(vv.variableId)) {
        throw new BadRequestException(`Variable ${vv.variableId} does not belong to catalog ${dto.catalogId}`);
      }
    }
    const submittedIds = new Set(dto.variableValues.map((v) => v.variableId));
    const missing = catalogVariables.filter((v) => v.isMandatory && !submittedIds.has(v.variableId));
    if (missing.length && !systemGenerated) throw new BadRequestException(`Missing required fields: ${missing.map((v) => v.label).join(", ")}`);
    this.checkFieldRules(catalogVariables, dto.variableValues);

    const variables = dto.variableValues.map((vv) => ({
      label: catalogVariables.find((c) => c.variableId === vv.variableId)?.label ?? "", value: vv.value,
    }));
    const plan = await this.timed("buildPlan", () => this.buildPlan(catalog, variables));
    await this.timed("approver validation", async () => {
      for (const level of plan.levels.filter((item) => !item.autoApproval && ["user", "group"].includes(item.approverType))) {
        const candidates = await this.resolveApproverUsers(level, { requestedBy, submittedBy } as ServiceRequest);
        const eligible = candidates.filter((user) => user.isActive !== false
          && user.userId !== requestedBy.userId && user.userId !== submittedBy.userId);
        if (!eligible.length) {
          throw new BadRequestException(`Approval "${level.title}" has no active approver other than the requester and submitter`);
        }
      }
    });

    let urgency = catalog.urgency ?? null;
    let serviceImpact = catalog.serviceImpact ?? null;
    if (dto.urgencyId) {
      urgency = await this.urgenciesRepo.findOne({ where: { urgencyId: dto.urgencyId } });
      if (!urgency) throw new BadRequestException(`Urgency ${dto.urgencyId} not found`);
    }
    if (dto.serviceImpactId) {
      serviceImpact = await this.serviceImpactsRepo.findOne({ where: { serviceImpactId: dto.serviceImpactId } });
      if (!serviceImpact) throw new BadRequestException(`Impact ${dto.serviceImpactId} not found`);
    }
    const priority = dto.priorityId
      ? await this.prioritiesRepo.findOne({ where: { priorityId: dto.priorityId, isActive: true } })
      : catalog.priority ?? (await this.sla.derivePriority(urgency?.urgencyId, serviceImpact?.serviceImpactId));
    if (dto.priorityId && !priority) throw new BadRequestException(`Service request priority ${dto.priorityId} not found or inactive`);

    const request = this.requestsRepo.create({ status: plan.levels.length ? "Pending Approval" : "Approved" });
    request.catalog = catalog;
    request.requestedBy = requestedBy;
    request.submittedBy = submittedBy;
    request.urgency = urgency;
    request.serviceImpact = serviceImpact;
    request.priority = priority;
    request.estimatedCost = catalog.estimatedCost != null ? String(catalog.estimatedCost) : null;
    request.assignmentGroup = catalog.fulfillmentGroup ?? catalog.assignmentGroup ?? null;
    const saved = await this.timed("request/values/history/approvals saves", async () => {
      const created = await this.requestsRepo.save(request);

      await this.valuesRepo.save(dto.variableValues.map((vv) => {
        const val = this.valuesRepo.create({ variable: { variableId: vv.variableId } as CatalogVariable, value: vv.value });
        val.request = created;
        return val;
      }));
      await this.log(created, "Submitted", submittedBy.userId,
        submittedByUserId === requestedByUserId ? undefined : `Submitted by ${submittedBy.fullName} for ${requestedBy.fullName}`);
      const requesterNotes = dto.notes?.trim();
      if (requesterNotes) await this.log(created, "Commented", submittedBy.userId, requesterNotes);

      if (plan.levels.length) {
        const now = new Date();
        await this.approvalsRepo.save(plan.levels.map((l) => this.approvalsRepo.create({
          request: created, levelNumber: l.levelNumber, title: l.title, approverType: l.approverType, approverRef: l.approverRef,
          onReject: l.onReject ?? "close", rejectArg: l.rejectArg ?? null, sourceLevelId: l.sourceLevelId ?? null,
          approvalRule: l.approvalRule ?? "any", approvers: l.approvers ?? null,
          onApprove: l.onApprove ?? "next", approveArg: l.approveArg ?? null, afterActions: l.afterActions ?? null, ...controlsOf(l),
          status: l.autoApproval ? "Approved" : "Pending",
          comments: l.autoApproval ? "Auto-approved" : undefined, actedAt: l.autoApproval ? now : undefined,
        })));
      }
      return created;
    });

    if (plan.initialActions.length) {
      await this.timed("initial actions", async () => this.runActions(await this.findOne(saved.requestId), plan.initialActions));
    }
    if (plan.levels.some((level) => level.autoApproval)) {
      await this.timed("auto-approval loop", async () => {
        for (const done of this.sortedApprovals(await this.findOne(saved.requestId)).filter((a) => a.status === "Approved")) {
          await this.afterLevelApproved(await this.findOne(saved.requestId), done);
        }
      });
    }
    const settled = await this.timed("settleApprovals", () => this.settleApprovals(saved.requestId));
    await this.timed("submitted notification", () => this.notifier.notify("submitted", settled));
    return this.present(settled);
    } finally {
      this.logger.log(`[submit] create total: ${Date.now() - createStartedAt}ms`);
    }
  }

  async update(requestId: number, actingUserId: number, dto: UpdateRequestDto): Promise<RequestView> {
    const request = await this.findOne(requestId);
    const untouchedApproval = request.status === "Returned" || (request.status === "Pending Approval" && !(request.approvals ?? []).some((a) => a.status !== "Pending"));
    const untouchedQueue = request.status === "Approved" && !request.assignedTo;
    if (!untouchedApproval && !untouchedQueue) {
      throw new BadRequestException("Only requests that nobody has started working on or approved can be edited");
    }
    const actingUser = await this.usersRepo.findOne({ where: { userId: actingUserId } });
    if (!actingUser) throw new NotFoundException(`User ${actingUserId} not found`);

    const catalogVariables = await this.catalogVariablesRepo.find({ where: { catalog: { catalogId: request.catalog.catalogId } } });
    const validIds = new Set(catalogVariables.map((v) => v.variableId));
    const seen = new Set<number>();
    for (const value of dto.variableValues) {
      if (seen.has(value.variableId)) throw new BadRequestException(`Variable ${value.variableId} was submitted more than once`);
      seen.add(value.variableId);
      if (!validIds.has(value.variableId)) throw new BadRequestException(`Variable ${value.variableId} does not belong to catalog ${request.catalog.catalogId}`);
    }
    const missing = catalogVariables.filter((v) => v.isMandatory && !seen.has(v.variableId));
    if (missing.length) throw new BadRequestException(`Missing required fields: ${missing.map((v) => v.label).join(", ")}`);
    this.checkFieldRules(catalogVariables, dto.variableValues);

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const requestRepo = runner.manager.getRepository(ServiceRequest);
      const valuesRepo = runner.manager.getRepository(RequestVariableValue);
      const historyRepo = runner.manager.getRepository(RequestHistory);
      const current = await requestRepo.findOne({ where: { requestId } });
      if (!current) throw new NotFoundException(`Request ${requestId} not found`);
      const old = await valuesRepo.find({ where: { request: { requestId } } });
      if (old.length) await valuesRepo.delete(old.map((v) => v.valueId));
      const fresh = dto.variableValues.map((value) => {
        const rv = valuesRepo.create({ variable: { variableId: value.variableId } as CatalogVariable, value: value.value });
        rv.request = current;
        return rv;
      });
      if (fresh.length) await valuesRepo.save(fresh);
      await historyRepo.save(Object.assign(historyRepo.create({
        action: "Updated", actionBy: actingUser, comments: dto.comments?.trim() || "Updated by administrator",
      }), { request: current }));
      await requestRepo.save(current);
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
    return this.present(await this.findOne(requestId));
  }

  // ───────────────────────── reading ─────────────────────────

  async findAllForUser(userId: number): Promise<RequestView[]> {
    await this.releaseDueWaits();
    const rows = await this.requestsRepo.find({
      where: [{ requestedBy: { userId } }, { submittedBy: { userId } }],
      relations: { catalog: { category: true }, priority: true, assignedTo: true, assignmentGroup: true, approvals: true, requestedBy: true, submittedBy: true },
      order: { createdAt: "DESC" },
    });
    return rows.map((r) => this.present(r));
  }

  async findAll(): Promise<RequestView[]> {
    const rows = await this.requestsRepo.find({
      relations: { catalog: true, requestedBy: true, priority: true, assignedTo: true },
      order: { createdAt: "DESC" },
    });
    return rows.map((r) => this.present(r));
  }

  /** Agent queue: filtered, paged, with per-status counts. */
  async queue(q: RequestQueueQueryDto, actor: Actor) {
    this.assertAgent(actor);
    await this.releaseDueWaits();
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const visibleGroupIds = this.isAdmin(actor)
      ? null
      : (await this.groupsRepo.createQueryBuilder("group")
        .innerJoin("group.members", "member", "member.userId = :userId", { userId: actor.userId })
        .where("group.isActive = :active", { active: true })
        .select("group.groupId", "groupId")
        .getRawMany<{ groupId: number }>())
        .map((group) => Number(group.groupId));
    const filtered = (withStatus: boolean) => {
      const qb = this.requestsRepo.createQueryBuilder("r")
        .leftJoinAndSelect("r.catalog", "catalog")
        .leftJoinAndSelect("catalog.category", "category")
        .leftJoinAndSelect("r.requestedBy", "requestedBy")
        .leftJoinAndSelect("r.priority", "priority")
        .leftJoinAndSelect("r.assignmentGroup", "grp")
        .leftJoinAndSelect("r.assignedTo", "assignee");
      if (visibleGroupIds !== null) {
        if (visibleGroupIds.length) qb.andWhere("grp.groupId IN (:...visibleGroupIds)", { visibleGroupIds });
        else qb.andWhere("1 = 0");
      }
      if (withStatus && q.status && q.status !== "All") qb.andWhere("r.status = :status", { status: q.status });
      if (q.groupId) qb.andWhere("grp.groupId = :groupId", { groupId: q.groupId });
      if (q.priorityId) qb.andWhere("priority.priorityId = :priorityId", { priorityId: q.priorityId });
      if (q.assignee === "me") qb.andWhere("assignee.userId = :me", { me: actor.userId });
      else if (q.assignee === "unassigned") qb.andWhere("assignee.userId IS NULL");
      else if (q.assignee && /^\d+$/.test(q.assignee)) qb.andWhere("assignee.userId = :aid", { aid: Number(q.assignee) });
      if (q.sla === "breached") {
        qb.andWhere("(r.slaBreached = true OR (r.slaFulfilmentTarget < :now AND r.status IN (:...open)))", { now: new Date(), open: ["Approved", "In Progress", "On Hold"] });
      }
      if (q.q?.trim()) {
        qb.andWhere("(r.requestNumber ILIKE :s OR catalog.catalogName ILIKE :s OR requestedBy.fullName ILIKE :s)", { s: `%${q.q.trim()}%` });
      }
      return qb;
    };

    const [items, total] = await filtered(true)
      .leftJoinAndSelect("r.approvals", "approvals")
      .leftJoinAndSelect("approvals.actedBy", "approvalActedBy")
      .leftJoinAndSelect("r.currentStep", "currentStep")
      .orderBy("r.createdAt", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    await Promise.all(items.map((request) => this.refreshPrioritySla(request)));
    const countRows = await filtered(false).select("r.status", "status").addSelect("COUNT(*)", "n").groupBy("r.status")
      .getRawMany<{ status: string; n: string }>().catch(async () => {
        // joins add selections; fall back to counting in memory for the (rare) groupBy failure
        const all = await filtered(false).getMany();
        const m: Record<string, number> = {};
        all.forEach((r) => { m[r.status] = (m[r.status] ?? 0) + 1; });
        return Object.entries(m).map(([status, n]) => ({ status, n: String(n) }));
      });
    const counts: Record<string, number> = {};
    countRows.forEach((r) => { counts[r.status] = Number(r.n); });
    const mineQuery = this.requestsRepo.createQueryBuilder("mineRequest")
      .leftJoin("mineRequest.assignmentGroup", "mineGroup")
      .leftJoin("mineRequest.assignedTo", "mineAssignee")
      .where("mineAssignee.userId = :userId", { userId: actor.userId })
      .andWhere("mineRequest.status IN (:...statuses)", { statuses: ["Approved", "In Progress", "On Hold"] });
    if (visibleGroupIds !== null) {
      if (visibleGroupIds.length) mineQuery.andWhere("mineGroup.groupId IN (:...visibleGroupIds)", { visibleGroupIds });
      else mineQuery.andWhere("1 = 0");
    }
    const mine = await mineQuery.getCount();
    return { items: items.map((r) => this.present(r)), total, page, pageSize, counts, mine };
  }

  async findOne(requestId: number): Promise<ServiceRequest> {
    const request = await this.requestsRepo.findOne({ where: { requestId }, relations: REQUEST_RELATIONS });
    if (!request) throw new NotFoundException(`Request ${requestId} not found`);
    request.approvals = this.sortedApprovals(request);
    request.tasks = [...(request.tasks ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    return request;
  }

  /** The record: request + SLA + timeline + what the viewer may do. */
  async findDetail(requestId: number, actor: Actor) {
    let request = await this.findOne(requestId);
    await this.refreshPrioritySla(request);
    if (request.status === "Waiting" && this.waitIsOver(request)) { await this.releaseWait(requestId); request = await this.findOne(requestId); }
    request = await this.ensureApprovalRows(request);
    await this.assertCanView(request, actor);
    const history = await this.historyRepo.find({
      where: { request: { requestId } }, relations: { actionBy: true, workflowStep: true }, order: { actionAt: "DESC" },
    });
    const pending = this.pendingLevel(request);
    const mine = await this.votesRepo.find({
      where: {
        approval: { request: { requestId } },
        user: { userId: actor.userId },
        decision: In(["Approved", "Rejected"]),
      },
      relations: { approval: true, user: true },
      order: { createdAt: "DESC" },
    });
    const canApprove =
      !!pending &&
      request.status === "Pending Approval" &&
      (await this.canActOnLevel(actor, pending, request));
    const approvals = (request.approvals ?? []).map((level) => {
      const vote = mine.find(
        (candidate) =>
          candidate.approval?.requestApprovalId === level.requestApprovalId,
      );
      return {
        ...level,
        ...approvalViewerVote({
          actorId: actor.userId,
          eligibleToAct: level.requestApprovalId === pending?.requestApprovalId && canApprove,
          requestPending: request.status === "Pending Approval",
          levelStatus: level.status,
          votes: vote
            ? [{
                slot: vote.slot,
                decision: vote.decision,
                createdAt: vote.createdAt,
                user: { userId: actor.userId },
              }]
            : [],
          actedById: level.actedBy?.userId,
          actedAt: level.actedAt,
        }),
      };
    });
    const presented = this.present(request);
    return {
      ...presented,
      approvals,
      history,
      viewer: {
        isRequester: request.requestedBy?.userId === actor.userId,
        isAgent: this.isAgent(actor),
        canResubmit: request.status === "Returned" && (request.requestedBy?.userId === actor.userId || this.isAdmin(actor)),
        canApprove: canApprove && pending?.status === "Pending",
      },
      guide: canApprove && pending ? await this.outcomeGuide(request, pending) : null,
    };
  }

  // ───────────────────────── approvals ─────────────────────────

  /** Approve Service Requests screen: what is waiting on this user, plus what they have already decided. */
  async approvalsFor(actor: Actor) {
    await this.releaseDueWaits();
    const pendingRequests = await this.requestsRepo.find({
      where: { status: "Pending Approval" },
      relations: { catalog: { category: true }, requestedBy: true, priority: true, approvals: true },
      order: { createdAt: "ASC" },
    });
    const out: Array<Record<string, unknown>> = [];
    for (const raw of pendingRequests) {
      const req = await this.ensureApprovalRows(await this.findOne(raw.requestId));
      const pending = this.pendingLevel(req);
      if (!pending) continue;
      const myVote = await this.votesRepo.findOne({
        where: {
          approval: { requestApprovalId: pending.requestApprovalId },
          user: { userId: actor.userId },
          decision: In(["Approved", "Rejected"]),
        },
      });
      if (myVote) {
        out.push(this.approvalRow(req, pending, "Responded, waiting for others", myVote.createdAt));
      } else if (await this.canActOnLevel(actor, pending, req)) {
        out.push(this.approvalRow(req, pending, "Awaiting me"));
      }
    }
    const decided = await this.approvalsRepo.find({
      where: { actedBy: { userId: actor.userId } }, relations: { request: { catalog: { category: true }, requestedBy: true, priority: true } },
      order: { actedAt: "DESC" }, take: 100,
    });
    const seen = new Set(out.map((o) => o.requestId as number));
    for (const d of decided) {
      if (seen.has(d.request.requestId)) continue;
      seen.add(d.request.requestId);
      const state = d.status === "Rejected"
        ? "Rejected"
        : d.status === "Info requested"
          ? "Requested information"
          : "Approved";
      out.push(this.approvalRow(d.request, d, state));
    }
    const votes = await this.votesRepo.find({
      where: { user: { userId: actor.userId }, decision: In(["Approved", "Rejected"]) },
      relations: { approval: { request: { catalog: { category: true }, requestedBy: true, priority: true } } },
      order: { createdAt: "DESC" },
      take: 100,
    });
    for (const vote of votes) {
      const request = vote.approval.request;
      if (seen.has(request.requestId)) continue;
      seen.add(request.requestId);
      out.push(this.approvalRow(request, vote.approval, vote.decision));
    }
    return out;
  }

  private approvalRow(request: ServiceRequest, level: RequestApproval, state: string, actedAt = level.actedAt ?? null) {
    return {
      requestId: request.requestId, requestNumber: request.requestNumber,
      catalogName: request.catalog?.catalogName ?? null, category: request.catalog?.category?.categoryName ?? null,
      requestedBy: request.requestedBy?.fullName ?? null, createdAt: request.createdAt,
      estimatedCost: request.estimatedCost ?? null, priority: request.priority?.priorityName ?? null,
      stage: level.title, levelNumber: level.levelNumber, state, status: request.status, actedAt,
    };
  }

  async actOnApproval(requestId: number, actor: Actor, action: "Approved" | "Rejected", comments?: string, expectedApprovalId?: number): Promise<RequestView> {
    let request = await this.ensureApprovalRows(await this.findOne(requestId));
    let pending = this.pendingLevel(request);
    if (expectedApprovalId != null && pending?.requestApprovalId !== expectedApprovalId) {
      const expected = request.approvals?.find(
        (level) => level.requestApprovalId === expectedApprovalId,
      );
      if (expected) {
        const priorVote = await this.votesRepo.findOne({
          where: {
            approval: { requestApprovalId: expectedApprovalId },
            user: { userId: actor.userId },
            decision: In(["Approved", "Rejected"]),
          },
        });
        assertNoPriorApprovalVote(priorVote);
      }
      throw alreadyRespondedConflict();
    }
    this.assertStatus(request, ["Pending Approval"], "act on approval");
    if (!pending) throw new BadRequestException(`Request ${requestId} has no approval waiting`);
    const priorVote = await this.votesRepo.findOne({
      where: {
        approval: { requestApprovalId: pending.requestApprovalId },
        user: { userId: actor.userId },
        decision: In(["Approved", "Rejected"]),
      },
    });
    assertNoPriorApprovalVote(priorVote);
    if (!(await this.canActOnLevel(actor, pending, request))) throw new ForbiddenException("This approval is not assigned to you");
    const text = comments?.trim();
    if (action === "Rejected" && pending.allowReject === false) throw new ForbiddenException("This step does not allow rejecting; approve it or ask for information");
    if (action === "Rejected" && !text && (pending.commentPolicy ?? "reject") !== "optional") throw new BadRequestException("A comment is required when rejecting a request");
    if (action === "Approved" && !text && pending.commentPolicy === "both") throw new BadRequestException("A comment is required to approve this step");

    const slots = await this.slotsFor(pending, request);
    const mine = slots.find((slot) => slot.users.some((user) => user.userId === actor.userId));
    if (!mine) throw new BadRequestException("You have already responded to this approval");
    const decision = await this.recordApprovalDecision(pending, mine.slot, slots, actor, action, text);
    pending = decision.level;
    await this.log(request, action, actor.userId, text ? `${pending.title}: ${text}` : pending.title);

    if (decision.outcome === "pending") {
      return this.present(await this.findOne(requestId));
    }
    if (action === "Rejected") return this.routeRejection(request, pending, actor, text!);

    await this.afterLevelApproved(await this.findOne(requestId), pending);
    const settled = await this.settleApprovals(requestId);
    if (settled.status === "Approved") await this.notifier.notify("approved", settled, { approvalStage: pending.title, approvalComments: text });
    return this.present(settled);
  }

  private async recordApprovalDecision(
    level: RequestApproval,
    slot: string,
    slots: { slot: string; users: User[] }[],
    actor: Actor,
    action: "Approved" | "Rejected",
    comments?: string,
  ): Promise<{ level: RequestApproval; outcome: ApprovalDecisionOutcome }> {
    return this.dataSource.transaction(async (manager) => {
      const approvalRepo = manager.getRepository(RequestApproval);
      const voteRepo = manager.getRepository(RequestApprovalVote);
      const locked = await approvalRepo.findOne({
        where: { requestApprovalId: level.requestApprovalId },
        lock: { mode: "pessimistic_write" },
      });
      if (!locked || locked.status !== "Pending") throw alreadyRespondedConflict();
      const eligibleSlot = slots.find((candidate) => candidate.slot === slot
        && candidate.users.some((user) => user.userId === actor.userId));
      if (!eligibleSlot) throw new ForbiddenException("This approval is not assigned to you");

      const alreadyVoted = await voteRepo.findOne({
        where: {
          approval: { requestApprovalId: locked.requestApprovalId },
          user: { userId: actor.userId },
          decision: In(["Approved", "Rejected"]),
        },
      });
      assertNoPriorApprovalVote(alreadyVoted);
      const existing = await voteRepo.findOne({
        where: { approval: { requestApprovalId: locked.requestApprovalId }, slot },
        relations: { user: true },
      });
      if (existing && existing.decision !== "Pending") {
        assertNoPriorApprovalVote(existing);
        throw new ForbiddenException("This approval slot has already been filled");
      }
      const vote = existing ?? voteRepo.create({
        approval: locked,
        slot,
        user: { userId: actor.userId } as User,
      });
      vote.user = { userId: actor.userId } as User;
      vote.decision = action;
      vote.comments = comments || null;
      await voteRepo.save(vote);

      const votes = await voteRepo.find({
        where: { approval: { requestApprovalId: locked.requestApprovalId } },
        relations: { user: true },
      });
      const { approved, rejected } = approvalVoteCounts(slots, votes);
      const outcome = evaluateApprovalRule(locked.approvalRule ?? "any", approved, rejected, slots.length);
      if (outcome === "pending") return { level: locked, outcome };

      const outstanding = votes.filter((item) => item.decision === "Pending");
      for (const item of outstanding) item.decision = "Cancelled";
      if (outstanding.length) await voteRepo.save(outstanding);

      locked.status = outcome === "approved" ? "Approved" : "Rejected";
      locked.actedBy = { userId: actor.userId } as User;
      locked.actedAt = new Date();
      locked.comments = comments || undefined;
      await approvalRepo.save(locked);
      return { level: locked, outcome };
    });
  }

  /** Runs the e-mail / update steps that follow an approved level, then its "If approved" outcome. */
  private async afterLevelApproved(request: ServiceRequest, level: RequestApproval): Promise<void> {
    await this.runActions(request, level.afterActions ?? []);
    const outcome = level.onApprove ?? "next";
    if (outcome === "next") return;
    const arg = (level.approveArg ?? "").trim();
    let fresh = await this.findOne(request.requestId);
    const skip = async (from: number, until: number) => {
      for (const l of this.sortedApprovals(fresh).filter((x) => x.status === "Pending" && x.levelNumber > from && x.levelNumber < until)) { l.status = "Skipped"; await this.approvalsRepo.save(l); }
    };
    if (outcome === "fulfil") return skip(level.levelNumber, Number.MAX_SAFE_INTEGER);
    if (outcome === "auto") return this.autoFulfil(fresh, arg || "Fulfilled automatically by a rule in the lifecycle.");
    if (outcome === "step") {
      // arg is the workflow step to continue at; its approval levels are the ones this request is waiting on
      const wanted = new Set((await this.levelsRepo.find({ where: { activity: { workflowStepId: Number(arg) } } })).map((l) => l.approvalLevelId));
      const target = this.sortedApprovals(fresh).find((x) => x.sourceLevelId != null && wanted.has(x.sourceLevelId) && x.levelNumber > level.levelNumber);
      if (target) await skip(level.levelNumber, target.levelNumber); // target not on this request's path: carry on as normal
      return;
    }
    if (outcome === "reroute") { await skip(level.levelNumber, Number.MAX_SAFE_INTEGER); await this.runActions(fresh, [{ type: "update", field: "assignmentGroup", value: Number(arg) }]); return; }
    if (outcome === "priority") return this.runActions(fresh, [{ type: "update", field: "priority", value: Number(arg) }]);
    if (outcome === "assign") return this.runActions(fresh, [{ type: "update", field: "agent", value: Number(arg) }]);
    if (outcome === "notify") {
      const m = /^(user|group|role|custom):(\d+)$/.exec(arg);
      if (m) {
        const users = await this.resolveApproverUsers({ approverType: m[1] as RequestApproverType, approverRef: Number(m[2]) }, fresh);
        await this.notifier.sendNotice(users, `Approved: ${fresh.requestNumber}`, `<p>${level.title} was approved for request ${fresh.requestNumber} (${fresh.catalog?.catalogName ?? ""}).</p>`);
      }
      return;
    }
    if (outcome === "task" && arg) {
      const next = (fresh.tasks ?? []).reduce((m, t) => Math.max(m, t.sortOrder), 0) + 1;
      const task = this.tasksRepo.create({ taskName: arg, status: "Open", priority: "medium", sortOrder: next, workflowTaskId: null });
      task.request = fresh;
      await this.tasksRepo.save(task);
    }
  }

  /** Set by the links service so a lifecycle "Create related record" step can raise a ticket. */
  private recordRaiser?: (request: ServiceRequest, action: Extract<PlanAction, { type: "record" }>) => Promise<string>;
  setRecordRaiser(fn: (request: ServiceRequest, action: Extract<PlanAction, { type: "record" }>) => Promise<string>): void { this.recordRaiser = fn; }

  private async deliverIntegration(requestId: number, action: Extract<PlanAction, { type: "integration" }>): Promise<void> {
    const r = await this.findOne(requestId);
    const payload = action.kind === "teams"
      ? { text: `Service request ${r.requestNumber} (${r.catalog?.catalogName ?? ""}) for ${r.requestedBy?.fullName ?? ""}: ${action.name}` }
      : { event: action.name, request: { number: r.requestNumber, item: r.catalog?.catalogName, status: r.status, requestedBy: r.requestedBy?.fullName, requestedByEmail: r.requestedBy?.email, priority: r.priority?.priorityName } };
    const label = action.kind === "teams" ? "Teams" : "webhook";
    try {
      const code = await postJson(action.url, payload, action.secret);
      await this.log(r, "Updated", null, code >= 200 && code < 300 ? `${action.name}: ${action.kind === "teams" ? "message posted to Teams" : "webhook delivered"} (${code})` : `${action.name}: the ${label} address answered ${code}`);
    } catch (err) {
      await this.log(r, "Updated", null, `${action.name}: could not reach the ${label} address - ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async runActions(request: ServiceRequest, actions: PlanAction[]): Promise<void> {
    for (const [i, a] of actions.entries()) {
      if (a.type === "email") { await this.notifier.sendRule(a.ruleId, request, a.to, {}); continue; }
      if (a.type === "wait") {
        // Pause here: what follows the wait runs when it ends.
        const r = await this.findOne(request.requestId);
        r.waitUntil = addBusinessDays(new Date(), a.days);
        r.deferredActions = actions.slice(i + 1);
        r.status = "Waiting";
        await this.requestsRepo.save(r);
        await this.log(r, "Updated", null, `Paused for ${a.days} business day${a.days === 1 ? "" : "s"} by the lifecycle`);
        return;
      }
      if (a.type === "record") {
        const what = a.recordType.replace("_", " ");
        try {
          const number = this.recordRaiser ? await this.recordRaiser(await this.findOne(request.requestId), a) : "";
          if (!number) await this.log(request, "Updated", null, `Could not raise the ${what}: not available`);
        } catch (err) {
          await this.log(request, "Updated", null, `Could not raise the ${what}: ${err instanceof Error ? err.message : String(err)}`);
        }
        continue;
      }
      if (a.type === "integration") {
        void this.deliverIntegration(request.requestId, a)
          .catch((e) => this.logger.warn(`Integration "${a.name}" failed: ${e}`));
        continue;
      }
      const r = await this.findOne(request.requestId);
      if (a.field === "priority") r.priority = { priorityId: a.value } as never;
      else if (a.field === "assignmentGroup") r.assignmentGroup = { groupId: a.value } as never;
      else if (a.field === "agent") r.assignedTo = { userId: a.value } as never;
      await this.requestsRepo.save(r);
    }
  }

  private waitIsOver(r: Pick<ServiceRequest, "waitUntil">): boolean {
    // A Waiting request with no end time can never be waited out, so it counts as over rather than staying stuck.
    return !r.waitUntil || new Date(r.waitUntil).getTime() <= Date.now();
  }

  /** Ends a Wait: runs the steps that were waiting, then lets the request carry on. */
  async releaseWait(requestId: number): Promise<void> {
    const r = await this.findOne(requestId);
    if (r.status !== "Waiting") return;
    const deferred = r.deferredActions ?? [];
    r.waitUntil = null; r.deferredActions = null; r.status = "Pending Approval";
    await this.requestsRepo.save(r);
    await this.log(r, "Updated", null, "The wait ended; the request carries on");
    // A failing e-mail / webhook step after the wait must not leave the request half-released.
    try { await this.runActions(r, deferred); } catch (err) {
      await this.log(r, "Updated", null, `A step after the wait failed and was skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
    if ((await this.findOne(requestId)).status === "Waiting") return; // paused again by a second wait
    const settled = await this.settleApprovals(requestId);
    if (settled.status === "Approved") {
      try { await this.notifier.notify("approved", settled, {}); } catch (err) { this.logger.warn(`Approved notice for request ${requestId} failed: ${err instanceof Error ? err.message : String(err)}`); }
    }
  }

  /**
   * Ends every Wait whose time is up. The scheduler calls it every minute, and reading a request or a list calls it
   * too, so a request never sits in Waiting after its time even if the scheduler is late.
   */
  async releaseDueWaits(): Promise<number> {
    let released = 0;
    for (const w of await this.requestsRepo.find({ where: { status: "Waiting" }, select: { requestId: true, waitUntil: true } })) {
      if (!this.waitIsOver(w)) continue;
      try { await this.releaseWait(w.requestId); released++; } catch (err) {
        this.logger.error(`Releasing the wait on request ${w.requestId} failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
      }
    }
    return released;
  }

  /** Fulfils a request with no manual work: the "If approved: fulfil automatically" outcome. */
  private async autoFulfil(request: ServiceRequest, note: string): Promise<void> {
    for (const l of this.sortedApprovals(request).filter((x) => x.status === "Pending")) { l.status = "Skipped"; await this.approvalsRepo.save(l); }
    const r = await this.findOne(request.requestId);
    for (const t of (r.tasks ?? []).filter((x) => x.status === "Open" || x.status === "In Progress")) { t.status = "Cancelled"; await this.tasksRepo.save(t); }
    const codes = await this.closureCodesRepo.find({ where: { isActive: true }, order: { closureCodeId: "ASC" } });
    const now = new Date();
    r.status = "Fulfilled";
    r.closureCode = codes.find((k) => /as requested/i.test(k.closureCodeName)) ?? codes[0] ?? null;
    r.fulfilmentNotes = note;
    r.fulfilledAt = now;
    r.subStatus = null;
    r.autoCloseAt = this.sla.autoCloseDate(now);
    r.slaPausedAt = null;
    await this.requestsRepo.save(r);
    await this.log(r, "Fulfilled", null, `Fulfilled automatically: ${note}`);
    await this.notifier.notify("fulfilled", await this.findOne(r.requestId));
  }

  // ───────────────────────── approver controls ─────────────────────────

  /** The approver asks the requester a question. The request waits with the requester, then returns to this approver. */
  async requestInfo(requestId: number, actor: Actor, question: string): Promise<RequestView> {
    const request = await this.ensureApprovalRows(await this.findOne(requestId));
    this.assertStatus(request, ["Pending Approval"], "ask for information on");
    const pending = this.pendingLevel(request);
    if (!pending) throw new BadRequestException(`Request ${requestId} has no approval waiting`);
    if (!(await this.canActOnLevel(actor, pending, request))) throw new ForbiddenException("This approval is not assigned to you");
    if (pending.allowInfo === false) throw new ForbiddenException("This step does not allow asking for information");
    const text = question?.trim();
    if (!text) throw new BadRequestException("Write the question for the requester");
    pending.status = "Info requested"; pending.actedBy = { userId: actor.userId } as User; pending.actedAt = new Date(); pending.comments = text;
    await this.approvalsRepo.save(pending);
    request.status = "Returned"; request.currentStep = undefined;
    await this.requestsRepo.save(request);
    await this.log(request, "Returned", actor.userId, `${pending.title}: asked for more information - ${text}`);
    const fresh = await this.findOne(requestId);
    await this.notifier.notify("returned", fresh, { approvalStage: pending.title, approvalComments: text });
    return this.present(fresh);
  }

  /** The approver hands the approval to someone else, who then decides alone. */
  async delegate(requestId: number, actor: Actor, toUserId: number, comments?: string): Promise<RequestView> {
    const request = await this.ensureApprovalRows(await this.findOne(requestId));
    this.assertStatus(request, ["Pending Approval"], "delegate");
    const pending = this.pendingLevel(request);
    if (!pending) throw new BadRequestException(`Request ${requestId} has no approval waiting`);
    if (!(await this.canActOnLevel(actor, pending, request))) throw new ForbiddenException("This approval is not assigned to you");
    if (!pending.allowDelegate) throw new ForbiddenException("This step does not allow delegating");
    const to = await this.usersRepo.findOne({ where: { userId: toUserId } });
    if (!to || to.isActive === false) throw new BadRequestException("Choose an active person to delegate to");
    if (to.userId === actor.userId) throw new BadRequestException("Choose someone other than yourself");
    if (to.userId === request.requestedBy?.userId) throw new BadRequestException("A request cannot be delegated to its own requester");
    pending.approverType = "user"; pending.approverRef = to.userId; pending.approvers = null; pending.approvalRule = "any";
    pending.pendingSince = new Date(); pending.remindedAt = null;
    await this.approvalsRepo.save(pending);
    await this.clearVotes(pending);
    await this.log(request, "Updated", actor.userId, `${pending.title} delegated to ${to.fullName}${comments?.trim() ? ` - ${comments.trim()}` : ""}`);
    const fresh = await this.findOne(requestId);
    await this.notifier.notify("approvalRequested", fresh, { approvers: [to], approvalStage: pending.title });
    return this.present(fresh);
  }

  /** Called every minute: sends reminders, and applies the timeout of approvals nobody answered. */
  async sweepApprovalTimers(): Promise<{ reminded: number; timedOut: number }> {
    let reminded = 0, timedOut = 0;
    await this.releaseDueWaits();
    const waiting = await this.requestsRepo.find({ where: { status: "Pending Approval" }, select: { requestId: true } });
    for (const w of waiting) {
      const request = await this.findOne(w.requestId);
      const level = this.pendingLevel(request);
      if (!level || !level.pendingSince) continue;
      const days = weekdaysSince(level.pendingSince);
      try {
        if (level.timeoutDays > 0 && days >= level.timeoutDays) { if (await this.applyTimeout(request, level)) timedOut++; continue; }
        if (level.remindDays > 0 && days >= level.remindDays && !level.remindedAt) {
          level.remindedAt = new Date(); await this.approvalsRepo.save(level);
          await this.log(request, "Updated", null, `Reminder sent to the approvers of ${level.title}: no decision after ${level.remindDays} business day${level.remindDays === 1 ? "" : "s"}`);
          await this.notifier.notify("approvalRequested", request, { approvers: await this.resolveApproverUsers(level, request), approvalStage: level.title });
          reminded++;
        }
      } catch (err) {
        this.logger.warn(`Approval timer for request ${request.requestId} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return { reminded, timedOut };
  }

  private async applyTimeout(request: ServiceRequest, level: RequestApproval): Promise<boolean> {
    const id = request.requestId;
    const note = `No decision in ${level.timeoutDays} business day${level.timeoutDays === 1 ? "" : "s"}`;
    if (level.onTimeout === "approve") {
      level.status = "Approved"; level.actedAt = new Date(); level.comments = `${note}: approved automatically`;
      await this.approvalsRepo.save(level);
      await this.log(request, "Approved", null, `${level.title}: ${note}, approved automatically`);
      await this.afterLevelApproved(await this.findOne(id), level);
      const settled = await this.settleApprovals(id);
      if (settled.status === "Approved") await this.notifier.notify("approved", settled, { approvalStage: level.title, approvalComments: level.comments });
      return true;
    }
    if (level.onTimeout === "reject") {
      level.status = "Rejected"; level.actedAt = new Date(); level.comments = `${note}: rejected automatically`;
      await this.approvalsRepo.save(level);
      await this.log(request, "Rejected", null, `${level.title}: ${note}, rejected automatically`);
      await this.routeRejection(request, level, null, level.comments);
      return true;
    }
    const m = /^(user|group|role|custom):(\d+)$/.exec(level.timeoutArg ?? "");
    const probe = m ? { approverType: m[1] as RequestApproverType, approverRef: Number(m[2]) } : null;
    if (!probe || !(await this.resolveApproverUsers(probe, request)).length) return false; // nobody to escalate to: keep waiting
    level.status = "Escalated"; level.actedAt = new Date(); level.comments = `${note}: escalated`;
    await this.approvalsRepo.save(level);
    await this.routeRejection(request, { ...level, onReject: "escalate", rejectArg: level.timeoutArg, isAppeal: false } as RequestApproval, null, level.comments);
    return true;
  }

  /** Plain-language consequences of each decision on the approval that is waiting, for the approver. */
  async outcomeGuide(request: ServiceRequest, level: RequestApproval) {
    const ordered = this.sortedApprovals(request);
    const mgr = this.requestsRepo.manager;
    const nameOf = async (arg?: string | null): Promise<string> => {
      const m = /^(user|group|role|custom):(\d+)$/.exec(arg ?? "");
      if (!m) return "the chosen approver";
      const q: Record<string, [string, string, string]> = { user: ["users", "user_id", "full_name"], group: ["approver_groups", "approver_group_id", "group_name"], role: ["roles", "role_id", "role_name"], custom: ["assignment_groups", "group_id", "group_name"] };
      const [t, k, n] = q[m[1]];
      const r = await mgr.query(`select ${n} as n from ${t} where ${k} = $1`, [Number(m[2])]);
      return r[0]?.n ?? "the chosen approver";
    };
    const idName = async (table: string, key: string, col: string, id: string) => (await mgr.query(`select ${col} as n from ${table} where ${key} = $1`, [Number(id)]))[0]?.n as string | undefined;
    const requester = request.requestedBy?.fullName ?? "the requester";
    const group = request.assignmentGroup?.groupName ?? request.catalog?.fulfillmentGroup?.groupName ?? request.catalog?.assignmentGroup?.groupName ?? "the fulfilment group";
    const next = ordered.find((l) => l.levelNumber > level.levelNumber && l.status === "Pending");
    const carry = next ? `goes on to ${next.title}` : `goes to ${group} for fulfilment`;
    const arg = (level.approveArg ?? "").trim();
    let ifApprove = carry;
    switch (level.onApprove ?? "next") {
      case "fulfil": ifApprove = `skips any remaining approvals and goes to ${group} for fulfilment`; break;
      case "reroute": ifApprove = `goes to ${(await idName("assignment_groups", "group_id", "group_name", arg)) ?? "another workgroup"} for fulfilment`; break;
      case "notify": ifApprove = `notifies ${await nameOf(arg)} and ${carry}`; break;
      case "priority": ifApprove = `is set to ${(await idName("service_priorities", "priority_id", "priority_name", arg)) ?? "the chosen priority"} and ${carry}`; break;
      case "assign": ifApprove = `is assigned to ${(await idName("users", "user_id", "full_name", arg)) ?? "the chosen agent"} and ${carry}`; break;
      case "task": ifApprove = `gets the task "${arg}" and ${carry}`; break;
      case "auto": ifApprove = "is fulfilled automatically with no manual work, and you are the last approval it needs"; break;
      case "step": {
        const wanted = new Set((await this.levelsRepo.find({ where: { activity: { workflowStepId: Number(arg) } } })).map((l) => l.approvalLevelId));
        const t = ordered.find((x) => x.sourceLevelId != null && wanted.has(x.sourceLevelId) && x.levelNumber > level.levelNumber);
        if (t) ifApprove = `skips ahead to ${t.title}`;
        break;
      }
    }
    let ifReject = `is closed as Rejected and ${requester} is notified`;
    const outcome = level.isAppeal ? "close" : level.onReject ?? "close";
    if (outcome === "rework") ifReject = `goes back to ${requester} to change and resubmit - ${level.rejectArg === "start" ? "the approvals then restart from step 1" : "it then comes back to this step"}`;
    if (outcome === "back") { const t = ordered.filter((l) => l.levelNumber < level.levelNumber && !l.isAppeal); const target = t.find((l) => l.sourceLevelId != null && String(l.sourceLevelId) === level.rejectArg) ?? t[t.length - 1]; ifReject = target ? `goes back to ${target.title} for another review` : `goes back to ${requester} (there is no earlier step)`; }
    if (outcome === "escalate") ifReject = `is escalated to ${await nameOf(level.rejectArg)} for the final decision`;
    if (outcome === "continue") ifReject = "carries on - this approval is advisory, so your rejection is recorded as advice";
    const bits: string[] = [];
    if (level.remindDays > 0) bits.push(`A reminder is sent after ${level.remindDays} business day${level.remindDays === 1 ? "" : "s"} without a decision.`);
    if (level.timeoutDays > 0) bits.push(`After ${level.timeoutDays} business day${level.timeoutDays === 1 ? "" : "s"} it ${level.onTimeout === "approve" ? "is approved automatically." : level.onTimeout === "reject" ? "is rejected automatically." : `is escalated to ${await nameOf(level.timeoutArg)}.`}`);
    return {
      stage: level.title, ifApprove: `The request ${ifApprove}.`, ifReject: level.allowReject === false ? "" : `The request ${ifReject}.`,
      canReject: level.allowReject !== false, canInfo: level.allowInfo !== false, canDelegate: !!level.allowDelegate,
      comment: level.commentPolicy ?? "reject", timing: bits.join(" "),
    };
  }

  /**
   * A rejection never moves the request on to the next approver by accident. What happens is the level's
   * "If rejected" setting: close (default), rework, back, escalate or continue. An appeal level always closes.
   */
  private async routeRejection(request: ServiceRequest, level: RequestApproval, actor: Actor | null, text: string): Promise<RequestView> {
    const by = actor?.userId ?? null;
    const id = request.requestId;
    let outcome: RejectOutcome = level.isAppeal ? "close" : level.onReject ?? "close";
    const ordered = this.sortedApprovals(request);
    const before = ordered.filter((l) => l.levelNumber < level.levelNumber && !l.isAppeal);
    const resetLevel = async (l: RequestApproval) => {
      l.status = "Pending"; l.actedBy = null; l.actedAt = null; l.comments = undefined;
      await this.approvalsRepo.save(l);
      await this.clearVotes(l);
    };

    let target: RequestApproval | undefined;
    let appealer: { approverType: RequestApproverType; approverRef: number } | undefined;
    if (outcome === "back") {
      target = before.find((l) => l.sourceLevelId != null && String(l.sourceLevelId) === level.rejectArg) ?? before[before.length - 1];
      if (!target) outcome = "rework"; // nothing earlier to go back to: hand it to the requester, never forward
    }
    if (outcome === "escalate") {
      const m = /^(user|group|role|custom):(\d+)$/.exec(level.rejectArg ?? "");
      if (m) {
        const probe = { approverType: m[1] as RequestApproverType, approverRef: Number(m[2]) };
        if ((await this.resolveApproverUsers(probe, request)).length) appealer = probe;
      }
      if (!appealer) outcome = "close"; // nobody can take the appeal: the rejection stands
    }

    if (outcome === "continue") {
      await this.log(request, "Updated", by, `${level.title}: rejection recorded as advice; the request carries on`);
      const settled = await this.settleApprovals(id);
      if (settled.status === "Approved") await this.notifier.notify("approved", settled, { approvalStage: level.title, approvalComments: text });
      return this.present(settled);
    }

    if (outcome === "rework") {
      request.status = "Returned";
      request.currentStep = undefined;
      await this.requestsRepo.save(request);
      await this.log(request, "Returned", by, `Returned to the requester by ${level.title}: ${text}`);
      const fresh = await this.findOne(id);
      await this.notifier.notify("returned", fresh, { approvalStage: level.title, approvalComments: text });
      return this.present(fresh);
    }

    if (outcome === "back" && target) {
      for (const l of ordered.filter((x) => x.levelNumber >= target!.levelNumber && x.levelNumber <= level.levelNumber && x.comments !== "Auto-approved")) await resetLevel(l);
      await this.log(request, "Returned", by, `Sent back to ${target.title} by ${level.title}: ${text}`);
      const settled = await this.settleApprovals(id);
      return this.present(settled);
    }

    if (outcome === "escalate" && appealer) {
      for (const l of [...ordered].filter((x) => x.levelNumber > level.levelNumber).sort((a, b) => b.levelNumber - a.levelNumber)) {
        l.levelNumber += 1;
        await this.approvalsRepo.save(l);
      }
      await this.approvalsRepo.save(this.approvalsRepo.create({
        request, levelNumber: level.levelNumber + 1, title: `Appeal: ${level.title}`, approverType: appealer.approverType,
        approverRef: appealer.approverRef, status: "Pending", onReject: "close", isAppeal: true, allowInfo: false, allowDelegate: false, commentPolicy: "reject", pendingSince: new Date(),
      }));
      await this.log(request, "Escalated", by, `${level.title} was rejected and has been escalated for a final decision: ${text}`);
      const settled = await this.settleApprovals(id);
      return this.present(settled);
    }

    // close: the request ends here and nothing after it is asked.
    for (const l of ordered.filter((a) => a.status === "Pending" && a.requestApprovalId !== level.requestApprovalId)) {
      l.status = "Skipped";
      await this.approvalsRepo.save(l);
    }
    request = await this.findOne(id);
    request.status = "Rejected";
    request.currentStep = undefined;
    request.closedAt = new Date();
    await this.requestsRepo.save(request);
    const fresh = await this.findOne(id);
    await this.notifier.notify("rejected", fresh, { approvalStage: level.title, approvalComments: text });
    return this.present(fresh);
  }

  /** The requester answers the comments and sends a returned request back into approval. */
  async resubmit(requestId: number, actor: Actor, comments?: string): Promise<RequestView> {
    const request = await this.findOne(requestId);
    this.assertStatus(request, ["Returned"], "resubmit");
    if (!this.isRequestOwner(request, actor) && !this.isAdmin(actor)) throw new ForbiddenException("Only the requester can resubmit this request");
    const ordered = this.sortedApprovals(request);
    const asked = ordered.find((l) => l.status === "Info requested");
    if (asked) {
      const answer = comments?.trim();
      if (!answer) throw new BadRequestException("Answer the approver's question before sending the request back");
      asked.status = "Pending"; asked.actedBy = null; asked.actedAt = null; asked.comments = undefined; asked.pendingSince = new Date(); asked.remindedAt = null;
      await this.approvalsRepo.save(asked);
      await this.clearVotes(asked);
      request.status = "Pending Approval";
      await this.requestsRepo.save(request);
      await this.log(request, "Resubmitted", actor.userId, `Answer to ${asked.title}: ${answer}`);
      return this.present(await this.settleApprovals(requestId));
    }
    const rejected = [...ordered].reverse().find((l) => l.status === "Rejected");
    const restart = rejected?.rejectArg === "start";
    for (const l of ordered) {
      if (restart ? l.comments !== "Auto-approved" : l.requestApprovalId === rejected?.requestApprovalId) {
        l.status = "Pending"; l.actedBy = null; l.actedAt = null; l.comments = undefined;
        await this.approvalsRepo.save(l);
        await this.clearVotes(l);
      }
    }
    request.status = "Pending Approval";
    await this.requestsRepo.save(request);
    await this.log(request, "Resubmitted", actor.userId, [restart ? "Approvals restart from the first step" : `Back to ${rejected?.title ?? "approval"}`, comments?.trim()].filter(Boolean).join(". "));
    return this.present(await this.settleApprovals(requestId));
  }

  // ───────────────────────── agent actions ─────────────────────────

  async assign(requestId: number, actor: Actor, dto: AssignRequestDto): Promise<RequestView> {
    this.assertAgent(actor);
    const request = await this.findOne(requestId);
    this.assertStatus(request, ["Approved", "In Progress", "On Hold"], "assign");
    let group = request.assignmentGroup ?? null;
    let assignee = request.assignedTo ?? null;
    if (dto.assignmentGroupId !== undefined) {
      group = await this.groupsRepo.findOne({ where: { groupId: dto.assignmentGroupId } });
      if (!group) throw new NotFoundException(`Assignment group ${dto.assignmentGroupId} not found`);
    }
    if (dto.assigneeId !== undefined) {
      assignee = await this.usersRepo.findOne({ where: { userId: dto.assigneeId } });
      if (!assignee || assignee.isActive === false) throw new BadRequestException("That user cannot be assigned");
    }
    if (assignee && group) {
      const g = await this.groupsRepo.findOne({ where: { groupId: group.groupId }, relations: { members: true } });
      if (g && g.members?.length && !g.members.some((m) => m.userId === assignee!.userId)) {
        throw new BadRequestException(`${assignee.fullName} is not a member of ${g.groupName}`);
      }
    }
    const now = new Date();
    request.assignmentGroup = group;
    request.assignedTo = assignee;
    if (assignee && !request.claimedAt) {
      request.claimedAt = now;
      request.slaResponseMet = !request.slaResponseTarget || now.getTime() <= request.slaResponseTarget.getTime();
    }
    const startNow = !!dto.start && request.status === "Approved" && !!assignee;
    if (startNow) request.status = "In Progress";
    await this.requestsRepo.save(request);
    const parts = [assignee ? `to ${assignee.fullName}` : "unassigned", group ? `(${group.groupName})` : ""].filter(Boolean).join(" ");
    await this.log(request, "Assigned", actor.userId, [`Assigned ${parts}`, dto.comments?.trim()].filter(Boolean).join(". "));
    if (startNow) await this.log(request, "Started", actor.userId);
    const fresh = await this.findOne(requestId);
    await this.notifier.notify("assigned", fresh);
    return this.present(fresh);
  }

  async start(requestId: number, actor: Actor): Promise<RequestView> {
    this.assertAgent(actor);
    const request = await this.findOne(requestId);
    this.assertStatus(request, ["Approved"], "start work");
    const now = new Date();
    if (!request.assignedTo) request.assignedTo = await this.actorUser(actor);
    if (!request.claimedAt) {
      request.claimedAt = now;
      request.slaResponseMet = !request.slaResponseTarget || now.getTime() <= request.slaResponseTarget.getTime();
    }
    request.status = "In Progress";
    await this.requestsRepo.save(request);
    await this.log(request, "Started", actor.userId);
    const fresh = await this.findOne(requestId);
    await this.notifier.notify("assigned", fresh);
    return this.present(fresh);
  }

  private async customStatus(name: string, stage: "work" | "hold") {
    const row = await this.statusConfigRepo.findOne({ where: { statusName: name, stage, isActive: true } });
    if (!row) throw new BadRequestException(`"${name}" is not an active ${stage === "hold" ? "On hold" : "In progress"} status`);
    return row;
  }

  async setSubStatus(requestId: number, actor: Actor, subStatus?: string | null): Promise<RequestView> {
    this.assertAgent(actor);
    const request = await this.findOne(requestId);
    this.assertStatus(request, ["In Progress"], "change the status");
    if (subStatus) await this.customStatus(subStatus, "work");
    request.subStatus = subStatus || null;
    await this.requestsRepo.save(request);
    await this.log(request, "Updated", actor.userId, subStatus ? `Status detail set to ${subStatus}` : "Status detail cleared");
    return this.present(await this.findOne(requestId));
  }

  async hold(requestId: number, actor: Actor, dto: HoldRequestDto): Promise<RequestView> {
    this.assertAgent(actor);
    const request = await this.findOne(requestId);
    this.assertStatus(request, ["In Progress"], "put on hold");
    let reason: RequestPendingReason | null = null;
    if (dto.pendingReasonId) {
      reason = await this.pendingReasonsRepo.findOne({ where: { pendingReasonId: dto.pendingReasonId, isActive: true } });
      if (!reason) throw new BadRequestException("That hold reason is not available");
    }
    if (dto.subStatus) await this.customStatus(dto.subStatus, "hold");
    request.status = "On Hold";
    request.pendingReason = reason;
    request.subStatus = dto.subStatus || null;
    request.holdNotes = dto.notes?.trim() || null;
    if (!reason || reason.slaImpact !== "continue") this.sla.pause(request);
    await this.requestsRepo.save(request);
    const label = reason?.pendingReasonName ?? dto.subStatus ?? "On hold";
    await this.log(request, "OnHold", actor.userId, [label, request.holdNotes].filter(Boolean).join(": "));
    const fresh = await this.findOne(requestId);
    await this.notifier.notify("onHold", fresh, { holdReason: label });
    return this.present(fresh);
  }

  async resume(requestId: number, actor: Actor): Promise<RequestView> {
    this.assertAgent(actor);
    const request = await this.findOne(requestId);
    this.assertStatus(request, ["On Hold"], "resume");
    await this.sla.resume(request);
    request.status = "In Progress";
    request.pendingReason = null;
    request.subStatus = null;
    request.holdNotes = null;
    await this.requestsRepo.save(request);
    await this.log(request, "Resumed", actor.userId);
    return this.present(await this.findOne(requestId));
  }

  async fulfil(requestId: number, actor: Actor, dto: FulfilRequestDto): Promise<RequestView> {
    this.assertAgent(actor);
    const request = await this.findOne(requestId);
    this.assertStatus(request, ["In Progress"], "fulfil");
    const code = await this.closureCodesRepo.findOne({ where: { closureCodeId: dto.closureCodeId, isActive: true } });
    if (!code) throw new BadRequestException("Choose an active closure code");
    const notes = dto.notes.trim();
    if (!notes) throw new BadRequestException("Fulfilment notes are required");
    const open = (request.tasks ?? []).filter((t) => t.status === "Open" || t.status === "In Progress");
    if (open.length) throw new BadRequestException(`${open.length} fulfilment task(s) are still open`);
    await this.assertWorkOrdersFinished(requestId);

    const now = new Date();
    request.status = "Fulfilled";
    request.closureCode = code;
    request.fulfilmentNotes = notes;
    request.fulfilledAt = now;
    request.subStatus = null;
    request.autoCloseAt = this.sla.autoCloseDate(now);
    request.slaPausedAt = null;
    if (request.slaFulfilmentTarget && now.getTime() > request.slaFulfilmentTarget.getTime()) request.slaBreached = true;
    await this.requestsRepo.save(request);
    await this.log(request, "Fulfilled", actor.userId, `${code.closureCodeName}: ${notes}`);
    const fresh = await this.findOne(requestId);
    await this.notifier.notify("fulfilled", fresh);
    return this.present(fresh);
  }

  /** A request cannot be fulfilled while a work order linked to it is still open. */
  private async assertWorkOrdersFinished(requestId: number): Promise<void> {
    const refs = (await this.linksRepo.find({ where: { request: { requestId }, targetType: "work_order" } })).map((l) => l.targetRef.trim().toLowerCase());
    if (!refs.length) return;
    const orders = await this.workOrdersRepo.createQueryBuilder("w").where("LOWER(w.wo_number) IN (:...refs)", { refs }).getMany();
    const open = orders.filter((w) => !["Completed", "Cancelled"].includes(w.status));
    if (open.length) {
      throw new BadRequestException(`${open.length} linked work order${open.length === 1 ? " is" : "s are"} still open (${open.map((w) => w.woNumber).join(", ")}). Complete or cancel ${open.length === 1 ? "it" : "them"} before fulfilling this request.`);
    }
  }

  async classify(requestId: number, actor: Actor, dto: ClassifyRequestDto): Promise<RequestView> {
    this.assertAgent(actor);
    const request = await this.findOne(requestId);
    if (TERMINAL.includes(request.status)) throw new BadRequestException(`Cannot reclassify a ${request.status.toLowerCase()} request`);
    const before = `${request.urgency?.urgencyName ?? "—"} / ${request.serviceImpact?.impactName ?? "—"} / ${request.priority?.priorityName ?? "—"}`;
    if (dto.urgencyId !== undefined) {
      const u = await this.urgenciesRepo.findOne({ where: { urgencyId: dto.urgencyId } });
      if (!u) throw new NotFoundException("Urgency not found");
      request.urgency = u;
    }
    if (dto.serviceImpactId !== undefined) {
      const i = await this.serviceImpactsRepo.findOne({ where: { serviceImpactId: dto.serviceImpactId } });
      if (!i) throw new NotFoundException("Service impact not found");
      request.serviceImpact = i;
    }
    if (!request.catalog.priority) {
      const derived = await this.sla.derivePriority(request.urgency?.urgencyId, request.serviceImpact?.serviceImpactId);
      if (derived) request.priority = derived;
    }
    await this.sla.recompute(request, request.catalog);
    await this.requestsRepo.save(request);
    const after = `${request.urgency?.urgencyName ?? "—"} / ${request.serviceImpact?.impactName ?? "—"} / ${request.priority?.priorityName ?? "—"}`;
    await this.log(request, "Reclassified", actor.userId, `Urgency / impact / priority: ${before} → ${after}`);
    return this.present(await this.findOne(requestId));
  }

  async updateTask(requestId: number, taskId: number, actor: Actor, status: "Open" | "In Progress" | "Completed" | "Cancelled"): Promise<RequestView> {
    this.assertAgent(actor);
    const request = await this.findOne(requestId);
    this.assertStatus(request, ["In Progress", "On Hold"], "update tasks");
    const task = request.tasks.find((t) => t.requestTaskId === taskId);
    if (!task) throw new NotFoundException(`Task ${taskId} not found on request ${requestId}`);
    task.status = status;
    const done = status === "Completed" || status === "Cancelled";
    task.completedAt = done ? new Date() : null;
    task.completedBy = done ? ({ userId: actor.userId } as User) : null;
    await this.tasksRepo.save(task);
    await this.log(request, "Updated", actor.userId, `Task "${task.taskName}" → ${status}`);
    return this.present(await this.findOne(requestId));
  }

  // ───────────────── requester (and agent) actions ─────────────────

  async comment(requestId: number, actor: Actor, text: string): Promise<RequestView> {
    const request = await this.findOne(requestId);
    await this.assertCanView(request, actor);
    const body = (text ?? "").trim();
    if (!body) throw new BadRequestException("Write a comment first");
    // A returned request is waiting for the requester. Their reply sends it straight back to the approver who
    // returned it (a question, or a rejection that asked for changes), with their words in the history.
    if (request.status === "Returned" && this.isRequestOwner(request, actor)) return this.resubmit(requestId, actor, body);
    await this.log(request, "Commented", actor.userId, body);
    return this.present(request);
  }

  async close(requestId: number, actor: Actor, comments?: string): Promise<RequestView> {
    const request = await this.findOne(requestId);
    const isRequester = request.requestedBy?.userId === actor.userId;
    if (!isRequester && !this.isAgent(actor)) throw new ForbiddenException("Only the requester or an agent can close this request");
    this.assertStatus(request, ["Fulfilled"], "close");
    request.status = "Closed";
    request.closedAt = new Date();
    request.autoCloseAt = null;
    await this.requestsRepo.save(request);
    const who = isRequester ? "Confirmed by the requester" : `Closed on behalf of the requester by ${(await this.actorUser(actor)).fullName}`;
    await this.log(request, "Closed", actor.userId, [who, comments?.trim()].filter(Boolean).join(". "));
    const fresh = await this.findOne(requestId);
    await this.notifier.notify("closed", fresh);
    return this.present(fresh);
  }

  /** Called by the scheduler when nobody confirmed in time. */
  async autoClose(requestId: number, businessDays: number): Promise<void> {
    const request = await this.findOne(requestId);
    if (request.status !== "Fulfilled") return;
    request.status = "Closed";
    request.closedAt = new Date();
    request.autoCloseAt = null;
    await this.requestsRepo.save(request);
    await this.log(request, "Closed", request.requestedBy.userId, `Closed automatically: no response within ${businessDays} business days of fulfilment`);
    await this.notifier.notify("closed", await this.findOne(requestId));
  }

  async reopen(requestId: number, actor: Actor, comments: string): Promise<RequestView> {
    const request = await this.findOne(requestId);
    const isRequester = request.requestedBy?.userId === actor.userId;
    if (!isRequester && !this.isAgent(actor)) throw new ForbiddenException("Only the requester or an agent can reopen this request");
    this.assertStatus(request, ["Fulfilled"], "reopen");
    request.status = "In Progress";
    request.fulfilledAt = null;
    request.autoCloseAt = null;
    request.closureCode = null;
    request.fulfilmentNotes = null;
    await this.requestsRepo.save(request);
    await this.log(request, "Reopened", actor.userId, comments.trim());
    const fresh = await this.findOne(requestId);
    await this.notifier.notify("reopened", fresh);
    return this.present(fresh);
  }

  async rate(requestId: number, actor: Actor, rating: number, comment?: string): Promise<RequestView> {
    const request = await this.findOne(requestId);
    if (request.requestedBy?.userId !== actor.userId) throw new ForbiddenException("Only the requester can rate this request");
    this.assertStatus(request, ["Fulfilled", "Closed"], "rate");
    if (request.feedbackSubmittedAt) throw new BadRequestException("This request has already been rated");
    request.feedbackRating = rating;
    request.feedbackComment = comment?.trim() || null;
    request.feedbackSubmittedAt = new Date();
    await this.requestsRepo.save(request);
    return this.present(await this.findOne(requestId));
  }

  /** Requesters can withdraw before fulfilment starts; admins can cancel any open request. */
  async cancel(requestId: number, actor: Actor, comments?: string): Promise<RequestView> {
    const request = await this.findOne(requestId);
    const isRequester = request.requestedBy?.userId === actor.userId;
    if (!this.isAdmin(actor) && !isRequester) throw new ForbiddenException("You can only cancel your own requests");
    const allowed = this.isAdmin(actor) ? ["Pending Approval", "Returned", "Waiting", "Approved", "In Progress", "On Hold", "Fulfilled"] : ["Pending Approval", "Returned", "Waiting", "Approved"];
    if (!allowed.includes(request.status)) {
      throw new BadRequestException(
        TERMINAL.includes(request.status)
          ? `Request ${requestId} is already ${request.status.toLowerCase()} and cannot be cancelled`
          : `A request that is ${request.status} can no longer be cancelled; ask the fulfilment team`
      );
    }
    return this.finishCancel(request, actor.userId, comments?.trim());
  }

  /** A fulfilment agent turns a request into an incident: the request is cancelled, with the incident number in its history. */
  async cancelAsConverted(requestId: number, actor: Actor, incidentNumber: string): Promise<RequestView> {
    this.assertAgent(actor);
    const request = await this.findOne(requestId);
    const allowed = ["Pending Approval", "Approved", "In Progress", "On Hold"];
    if (!allowed.includes(request.status)) throw new BadRequestException(`A request that is ${request.status.toLowerCase()} cannot be converted to an incident`);
    return this.finishCancel(request, actor.userId, `Handled as incident ${incidentNumber}`);
  }

  private async finishCancel(request: ServiceRequest, actorId: number, comments?: string): Promise<RequestView> {
    for (const l of request.approvals.filter((a) => a.status === "Pending")) { l.status = "Skipped"; await this.approvalsRepo.save(l); }
    for (const t of request.tasks.filter((x) => x.status === "Open" || x.status === "In Progress")) { t.status = "Cancelled"; await this.tasksRepo.save(t); }
    request.status = "Cancelled";
    request.currentStep = undefined;
    request.closedAt = new Date();
    request.autoCloseAt = null;
    request.slaPausedAt = null;
    await this.requestsRepo.save(request);
    await this.log(request, "Cancelled", actorId, comments);
    const fresh = await this.findOne(request.requestId);
    await this.notifier.notify("cancelled", fresh);
    return this.present(fresh);
  }

  // ───────────────────── scheduler support ─────────────────────

  findDueForAutoClose(now = new Date()): Promise<ServiceRequest[]> {
    return this.requestsRepo.createQueryBuilder("r")
      .where("r.status = 'Fulfilled'").andWhere("r.auto_close_at IS NOT NULL").andWhere("r.auto_close_at <= :now", { now }).getMany();
  }

  async sweepSla(now = new Date()): Promise<{ breached: number; warned: number }> {
    const open = ["Approved", "In Progress"];
    const due = await this.requestsRepo.createQueryBuilder("r")
      .where("r.status IN (:...open)", { open }).andWhere("r.sla_breached = false").andWhere("r.sla_paused_at IS NULL")
      .andWhere("((r.sla_fulfilment_target IS NOT NULL AND r.sla_fulfilment_target < :now) OR (r.claimed_at IS NULL AND r.sla_response_target IS NOT NULL AND r.sla_response_target < :now))", { now })
      .getMany();
    for (const r of due) await this.requestsRepo.update({ requestId: r.requestId }, { slaBreached: true });

    const candidates = await this.requestsRepo.createQueryBuilder("r")
      .where("r.status IN (:...open)", { open }).andWhere("r.sla_breached = false").andWhere("r.sla_warning_sent = false")
      .andWhere("r.sla_paused_at IS NULL").andWhere("r.sla_fulfilment_target IS NOT NULL").andWhere("r.sla_started_at IS NOT NULL")
      .andWhere("r.sla_fulfilment_target > :now", { now }).getMany();
    let warned = 0;
    for (const r of candidates) {
      const total = r.slaFulfilmentTarget!.getTime() - r.slaStartedAt!.getTime();
      const window = Math.min(60 * 60 * 1000, total * 0.2);
      if (r.slaFulfilmentTarget!.getTime() - now.getTime() <= window) {
        await this.requestsRepo.update({ requestId: r.requestId }, { slaWarningSent: true });
        await this.notifier.notify("slaWarning", await this.findOne(r.requestId));
        warned++;
      }
    }
    return { breached: due.length, warned };
  }
}
