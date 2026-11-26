import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, In, Repository } from "typeorm";
import { Change, ChangeState, ChangeStatus } from "./entities/change.entity";
import { ChangeApproval } from "./entities/change-approval.entity";
import { ChangeTask } from "./entities/change-task.entity";
import { ChangeWorkNote } from "./entities/change-work-note.entity";
import { User } from "../users/entities/user.entity";
import { isStaff } from "../../common/utils/roles.util";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import {
  ApprovalRuleText, ChangeAttrs, ChangeSettings, FAILED_OUTCOMES, LifecycleStep, PathStage, activeGroup, approvalPath, baseOf, categoryGroup, condMet, derivePriority, gatesOf, hasStep, lifecycleOf, modelFor, pirRequired, scoreRisk, stepType,
} from "./change-config";
import { ChangeConfigService } from "./change-config.service";
import { ChangeNotifier } from "./change-notifier.service";
import { Conflict, findConflicts, windowIntervals } from "./change-conflicts";
import { postJson } from "../requests/outbound-webhook";
import {
  ApprovalDecisionDto, ChangeListQueryDto, CloseChangeDto, CompleteImplementationDto, CreateChangeDto, CreateChangeTaskDto,
  PreviewChangeDto, SavePirDto, UpdateChangeDto, UpdateChangeTaskDto,
} from "./dto/change.dto";

export interface Actor { userId: number; username: string; roles: string[] }
export const isAdminActor = (a: Actor) => a.roles.some((r) => /^admin/i.test(r));

/** Legacy `status` column derived from the ITIL `state`. */
const STATUS_FOR_STATE: Record<ChangeState, ChangeStatus> = {
  New: "Open", Assess: "Open", Authorize: "Open", Scheduled: "Open",
  Implement: "In Progress", Review: "In Progress", Closed: "Completed", Cancelled: "Cancelled",
};
const TERMINAL: ChangeState[] = ["Closed", "Cancelled"];
const EDITABLE: ChangeState[] = ["New", "Assess", "Authorize", "Scheduled"];
const LIVE: ChangeState[] = ["New", "Assess", "Authorize", "Scheduled", "Implement"];
const OPEN: ChangeState[] = ["New", "Assess", "Authorize", "Scheduled", "Implement", "Review"];
/** Edits to these after approval send the change back for approval (when the approval policy says so). */
const APPROVAL_SENSITIVE = ["plannedStart", "plannedEnd", "configurationItems", "implementationPlan", "backoutPlan", "testPlan", "businessService"] as const;
const CODE_FOR_OUTCOME: Record<string, string> = { Successful: "Successful", "Successful with issues": "Successful with issues", Failed: "Unsuccessful", "Backed out": "Backed out" };

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const sameTime = (a?: Date | null, b?: Date | null) => (a ? +new Date(a) : 0) === (b ? +new Date(b) : 0);

@Injectable()
export class ChangesService {
  constructor(
    @InjectRepository(Change) private repo: Repository<Change>,
    @InjectRepository(ChangeApproval) private approvals: Repository<ChangeApproval>,
    @InjectRepository(ChangeTask) private tasks: Repository<ChangeTask>,
    @InjectRepository(ChangeWorkNote) private notes: Repository<ChangeWorkNote>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(AssignmentGroup) private workgroupRepo: Repository<AssignmentGroup>,
    private cfg: ChangeConfigService,
    private notifier: ChangeNotifier,
  ) {}

  // ───────── helpers ─────────
  private async nextCode(): Promise<string> {
    const last = await this.repo.findOne({ where: {}, order: { changeId: "DESC" } });
    return `CHG${String((last ? last.changeId : 0) + 1).padStart(9, "0")}`;
  }
  private async userById(id?: number | null): Promise<User | undefined> {
    return id ? (await this.users.findOne({ where: { userId: id } })) ?? undefined : undefined;
  }
  private requireStaff(actor: Actor) {
    if (!isStaff(actor.roles)) throw new ForbiddenException("Only change staff can do this.");
  }
  private setState(c: Change, state: ChangeState) {
    c.state = state;
    c.status = STATUS_FOR_STATE[state];
    if (TERMINAL.includes(state) && !c.completedAt) c.completedAt = new Date();
  }
  /**
   * Save a change without its loaded relation collections. A change read with `approvals: []` that is saved after
   * approval rows were created would otherwise detach those rows (TypeORM nullifies "orphaned" one-to-many children).
   */
  private persist(c: Change): Promise<Change> {
    const copy: Change = Object.assign(Object.create(Object.getPrototypeOf(c)), c);
    delete copy.approvals; delete copy.tasks; delete copy.workNotes;
    return this.repo.save(copy);
  }
  private lifecycleProgress(changeId: number): Promise<Change | null> {
    return this.repo.createQueryBuilder("c")
      .addSelect(["c.lifecycleSteps", "c.lifecycleStepIndex", "c.lifecycleWaitUntil"])
      .where("c.changeId = :changeId", { changeId })
      .getOne();
  }
  private fullName(u?: User | null) { return u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username : "someone"; }

  private applyRisk(c: Change, s: ChangeSettings) {
    if (baseOf(s, c.changeType) === "Standard") { c.riskScore = 0; c.riskLevel = "Low"; return; }
    const r = scoreRisk(s, c.riskAnswers, c.changeType, c.category);
    if (r.answered === 0) { c.riskScore = undefined; c.riskLevel = undefined; return; }
    c.riskScore = r.score; c.riskLevel = r.level;
  }

  private applyFields(c: Change, dto: UpdateChangeDto | CreateChangeDto, s: ChangeSettings) {
    const { assignedToId, plannedStart, plannedEnd, riskAnswers, ...rest } = dto as any;
    delete rest.submit; delete rest.changeType; delete rest.templateId;
    Object.assign(c, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)));
    if (plannedStart !== undefined) c.plannedStart = plannedStart ? new Date(plannedStart) : undefined;
    if (plannedEnd !== undefined) c.plannedEnd = plannedEnd ? new Date(plannedEnd) : undefined;
    if (c.plannedStart && c.plannedEnd && c.plannedEnd <= c.plannedStart) throw new BadRequestException("Planned end must be after planned start.");
    if (riskAnswers !== undefined) c.riskAnswers = riskAnswers;
    this.applyRisk(c, s);
    c.priority = (dto as any).priority ?? derivePriority(c.impact, c.urgency) ?? c.priority;
  }

  /** The category supplies the default assignment group (its own, or its parent's) when none was chosen, provided it is a real workgroup. */
  private async defaultGroup(c: Change, s: ChangeSettings) {
    if (c.assignmentGroup || !c.category) return;
    const name = categoryGroup(s, c.category);
    if (name && (await this.workgroupRepo.findOne({ where: { groupName: name, isActive: true } }))) c.assignmentGroup = name;
  }

  /** Assignment groups come from Configuration → Workgroup. A change can only name an existing, active workgroup. */
  private async checkWorkgroup(name?: string | null) {
    if (!name) return;
    const g = await this.workgroupRepo.findOne({ where: { groupName: name, isActive: true } });
    if (!g) throw new BadRequestException(`"${name}" is not a workgroup. Choose an assignment group from the Workgroup list.`);
  }
  async workgroups() { return this.cfg.workgroups(); }

  /** Attributes the lifecycle conditions can test. */
  private attrsOf(c: Change, conflict = false): ChangeAttrs {
    return {
      priority: c.priority ?? "", service: c.businessService ?? "", outage: c.causesOutage ? "Yes" : "No", conflict: conflict ? "Yes" : "No",
      leadDays: c.plannedStart ? Math.max(0, Math.ceil((c.plannedStart.getTime() - Date.now()) / 86400000)) : 0, ciCount: c.configurationItems?.length ?? 0,
    };
  }

  /** Mark open approval rows of a change as no longer needed (optionally only one stage). */
  private async closeOpenRows(changeId: number, stage?: number) {
    const qb = this.approvals.createQueryBuilder().update(ChangeApproval).set({ status: "Not required" }).where("change_id = :cid AND status = 'Pending'", { cid: changeId });
    if (stage !== undefined) qb.andWhere("stage = :st", { st: stage });
    await qb.execute();
  }

  private async liveChanges(): Promise<Change[]> {
    return this.repo.createQueryBuilder("c").where("c.state IN ('New','Assess','Authorize','Scheduled','Implement')")
      .andWhere("c.plannedStart IS NOT NULL AND c.plannedEnd IS NOT NULL").getMany();
  }
  async conflictsFor(c: Change, s?: ChangeSettings): Promise<Conflict[]> {
    const cfg = s ?? (await this.cfg.effective());
    return findConflicts(c, await this.liveChanges(), cfg.windows.filter((w) => w.active));
  }

  /** The people a path stage asks: a named approver, the members of the change's workgroup, or the members of an approval group. */
  private async stageMembers(item: PathStage, c: Change, s: ChangeSettings): Promise<number[]> {
    if (item.userId) return [item.userId];
    if (item.role === "assignmentGroup") {
      const g = c.assignmentGroup ? await this.workgroupRepo.findOne({ where: { groupName: c.assignmentGroup }, relations: { members: true } }) : null;
      return (g?.members ?? []).map((m) => m.userId);
    }
    return (activeGroup(s, item.group)?.members ?? []).map((m) => m.userId);
  }

  /** Approval rows for the path: one per member of the group (so "majority"/"all" can be counted), or a single open row when nobody is set up to decide. */
  private async buildApprovals(c: Change, path: PathStage[], s: ChangeSettings, startStage = 1): Promise<ChangeApproval[]> {
    const rows: ChangeApproval[] = [];
    for (const item of path) {
      const stage = startStage + item.stage - 1;
      // The requester and owner can never approve their own change, so they are not counted among the voters.
      const voters = (await this.stageMembers(item, c, s)).filter((id) => (id !== c.requestedBy?.userId && id !== c.assignedTo?.userId));
      if (voters.length) {
        for (const id of voters) rows.push(this.approvals.create({ change: c, stage, approvalGroup: item.group, rule: item.rule, approver: { userId: id } as User, status: "Pending" }));
      } else rows.push(this.approvals.create({ change: c, stage, approvalGroup: item.group, rule: item.rule, status: "Pending" }));
    }
    return this.approvals.save(rows);
  }

  // ───────── RFC ─────────
  /** `actor` is optional: linked-record creation from a service request has no change-staff context. */
  async create(dto: CreateChangeDto, actor?: Actor): Promise<Change> {
    const s = await this.cfg.effective();
    const model = dto.changeType ? modelFor(s, dto.changeType) : s.models.find((m) => m.base === "Normal" && m.active);
    if (!model) throw new BadRequestException("Unknown change model.");
    if (!model.active) throw new BadRequestException(`The ${model.name} model is not currently offered.`);
    if (baseOf(s, model.name) === "Standard") {
      const t = s.templates.find((x) => x.id === dto.templateId);
      if (dto.templateId && (!t || t.status !== "Active")) throw new BadRequestException("That standard change template is not active.");
    }
    const c = this.repo.create({
      changeCode: await this.nextCode(), changeType: model.name, shortDescription: dto.shortDescription,
      requestedBy: await this.userById(actor?.userId), templateId: dto.templateId ?? null,
      configurationItems: [], riskAnswers: {}, relatedRecords: [], causesOutage: false,
    });
    await this.checkWorkgroup(dto.assignmentGroup);
    this.applyFields(c, dto, s);
    await this.defaultGroup(c, s);
    if (dto.assignedToId) c.assignedTo = await this.userById(dto.assignedToId);
    this.setState(c, "New");
    const saved = await this.persist(c);
    if (dto.submit && actor) {
      // Create-and-submit is one action: if validation blocks the submit, the draft must not be left behind.
      try { return await this.submit(saved.changeId, actor); }
      catch (e) {
        await this.repo.delete(saved.changeId).catch(() => undefined);
        throw e;
      }
    }
    return this.findOne(saved.changeId);
  }

  async findAll(q: ChangeListQueryDto, actor: Actor): Promise<Change[]> {
    const qb = this.repo.createQueryBuilder("c")
      .leftJoinAndSelect("c.assignedTo", "assignedTo").leftJoinAndSelect("c.requestedBy", "requestedBy").orderBy("c.createdAt", "DESC");
    // Requesters see their own changes (and those they are asked to approve); change staff see everything.
    if (!isStaff(actor.roles)) qb.andWhere(new Brackets((w) => w.where("requestedBy.userId = :uid", { uid: actor.userId })
      .orWhere("EXISTS (SELECT 1 FROM change_approvals ap WHERE ap.change_id = c.change_id AND ap.approver_id = :uid)", { uid: actor.userId })));
    if (q.type) qb.andWhere("c.changeType = :type", { type: q.type });
    if (q.risk) qb.andWhere("c.riskLevel = :risk", { risk: q.risk });
    if (q.state) qb.andWhere("c.state = :state", { state: q.state });
    if (q.group) qb.andWhere("c.assignmentGroup = :group", { group: q.group });
    if (q.from) qb.andWhere("(c.plannedEnd IS NULL OR c.plannedEnd >= :from)", { from: q.from });
    if (q.to) qb.andWhere("(c.plannedStart IS NULL OR c.plannedStart <= :to)", { to: q.to });
    if (q.q) qb.andWhere(new Brackets((w) => w
      .where("c.changeCode ILIKE :q", { q: `%${q.q}%` }).orWhere("c.shortDescription ILIKE :q", { q: `%${q.q}%` }).orWhere("c.businessService ILIKE :q", { q: `%${q.q}%` })));
    return qb.getMany();
  }

  async findOne(changeId: number): Promise<Change> {
    const c = await this.repo.findOne({
      where: { changeId },
      relations: { assignedTo: true, requestedBy: true, approvals: { approver: true }, tasks: { assignedTo: true }, workNotes: { author: true } },
      order: { approvals: { stage: "ASC", id: "ASC" }, tasks: { id: "ASC" }, workNotes: { createdAt: "DESC" } },
    });
    if (!c) throw new NotFoundException(`Change ${changeId} not found`);
    return c;
  }

  /** Same as findOne, restricted to staff, the requester, and people asked to approve it. */
  async findOneFor(changeId: number, actor: Actor): Promise<Change> {
    const c = await this.findOne(changeId);
    const allowed = isStaff(actor.roles) || c.requestedBy?.userId === actor.userId || (c.approvals ?? []).some((a) => a.approver?.userId === actor.userId);
    if (!allowed) throw new NotFoundException(`Change ${changeId} not found`);
    return c;
  }

  async detail(changeId: number, actor: Actor) {
    const c = await this.findOneFor(changeId, actor);
    const conflicts = TERMINAL.includes(c.state) ? [] : await this.conflictsFor(c);
    return Object.assign(c, { conflicts });
  }

  async update(changeId: number, dto: UpdateChangeDto, actor: Actor): Promise<Change> {
    this.requireStaff(actor);
    const s = await this.cfg.effective();
    const c = await this.findOne(changeId);
    if (!EDITABLE.includes(c.state)) throw new BadRequestException(`A change in ${c.state} can no longer be edited.`);
    const before = { plannedStart: c.plannedStart, plannedEnd: c.plannedEnd, configurationItems: c.configurationItems, implementationPlan: c.implementationPlan, backoutPlan: c.backoutPlan, testPlan: c.testPlan, businessService: c.businessService };
    if (dto.assignmentGroup && dto.assignmentGroup !== c.assignmentGroup) await this.checkWorkgroup(dto.assignmentGroup);
    this.applyFields(c, dto, s);
    await this.defaultGroup(c, s);
    if (dto.assignedToId !== undefined) c.assignedTo = await this.userById(dto.assignedToId);
    const changed = APPROVAL_SENSITIVE.filter((k) => (k === "plannedStart" || k === "plannedEnd") ? !sameTime(before[k], c[k]) : !sameJson(before[k], c[k]));
    const reapprove = s.approval.settings.reapprove && ["Authorize", "Scheduled"].includes(c.state) && changed.length > 0 && baseOf(s, c.changeType) !== "Standard";
    await this.persist(c);
    if (reapprove) await this.restartApproval(c, s, `Approval restarted because ${changed.join(", ")} changed after approval.`, actor);
    return this.findOne(changeId);
  }

  /** Wipe the old approval rows and ask again from stage 1. */
  private async restartApproval(c: Change, s: ChangeSettings, note: string, actor: Actor) {
    await this.approvals.createQueryBuilder().delete().from(ChangeApproval).where("change_id = :cid", { cid: c.changeId }).execute();
    const fresh = await this.repo.findOne({ where: { changeId: c.changeId }, relations: { requestedBy: true, assignedTo: true } });
    const progress = await this.lifecycleProgress(c.changeId);
    if (Array.isArray(progress?.lifecycleSteps)) {
      fresh!.lifecycleSteps = progress.lifecycleSteps;
      fresh!.lifecycleStepIndex = 0;
      fresh!.lifecycleWaitUntil = null;
      this.setState(fresh!, "Assess");
      await this.persist(fresh!);
      await this.addNote(c.changeId, note, actor);
      await this.continueLifecycle(c.changeId);
      return;
    }
    const path = approvalPath(s, c.changeType, c.riskLevel, c.category, this.attrsOf(fresh!, (await this.conflictsFor(fresh!, s)).some((x) => x.kind === "Change")));
    fresh!.lifecycleSteps = null; fresh!.lifecycleStepIndex = null; fresh!.lifecycleWaitUntil = null;
    if (path.length) { await this.buildApprovals(fresh!, path, s); this.setState(fresh!, "Authorize"); } else this.setState(fresh!, "Scheduled");
    await this.persist(fresh!);
    await this.addNote(c.changeId, note, actor);
    if (path.length) await this.notifier.notify("e2", c.changeId);
  }

  private lifecycleSteps(c: Change, s: ChangeSettings): LifecycleStep[] {
    return (c.lifecycleSteps as LifecycleStep[] | null) ?? lifecycleOf(s, c.changeType).steps;
  }

  private async createLifecycleTask(c: Change, step: LifecycleStep) {
    const n = (await this.tasks.count({ where: { change: { changeId: c.changeId } } })) + 1;
    await this.tasks.save(this.tasks.create({
      change: c, taskCode: `${c.changeCode}-T${n}`, shortDescription: step.taskName!,
      assignmentGroup: step.taskGroup || undefined, assignedTo: await this.userById(step.taskAssignedToId),
    }));
  }

  private async createRelatedChange(c: Change, step: LifecycleStep) {
    const related = this.repo.create({
      changeCode: await this.nextCode(), changeType: c.changeType, shortDescription: step.recordTitle!,
      description: step.recordDescription || undefined, requestedBy: c.requestedBy, assignmentGroup: c.assignmentGroup,
      businessService: c.businessService, category: c.category, configurationItems: [], riskAnswers: {},
      relatedRecords: [{ kind: "Change", number: c.changeCode, title: c.shortDescription }],
      causesOutage: false, state: "New", status: "Open",
    });
    const saved = await this.persist(related);
    c.relatedRecords = [...(c.relatedRecords ?? []), { kind: "Change", number: saved.changeCode, title: saved.shortDescription }];
  }

  private async executeLifecycleAction(c: Change, step: LifecycleStep) {
    switch (stepType(step)) {
      case "email":
        await this.notifier.sendLifecycleEmail(c.changeId, step.recipients ?? [], step.subject ?? "", step.body ?? "");
        break;
      case "update":
        if (step.updateValue !== undefined) {
          switch (step.updateField) {
            case "shortDescription": c.shortDescription = step.updateValue; break;
            case "description": c.description = step.updateValue; break;
            case "priority": c.priority = step.updateValue; break;
            case "category": c.category = step.updateValue; break;
            case "businessService": c.businessService = step.updateValue; break;
            case "impact": c.impact = step.updateValue; break;
            case "urgency": c.urgency = step.updateValue; break;
            case "justification": c.justification = step.updateValue; break;
            case "communicationPlan": c.communicationPlan = step.updateValue; break;
          }
          if (step.updateField === "impact" || step.updateField === "urgency") {
            c.priority = derivePriority(c.impact, c.urgency) ?? c.priority;
          }
        }
        break;
      case "task":
        await this.createLifecycleTask(c, step);
        break;
      case "record":
        await this.createRelatedChange(c, step);
        break;
      case "integration":
        if (!step.integrationUrl) throw new BadRequestException(`Lifecycle step "${step.name}" has no integration URL.`);
        const status = await postJson(step.integrationUrl, {
          change: {
            id: c.changeId, number: c.changeCode, shortDescription: c.shortDescription, description: c.description ?? "",
            type: c.changeType, state: c.state, category: c.category ?? "", service: c.businessService ?? "",
            risk: c.riskLevel ?? "", priority: c.priority ?? "", plannedStart: c.plannedStart ?? null, plannedEnd: c.plannedEnd ?? null,
          },
        });
        if (status < 200 || status >= 300) throw new Error(`Integration "${step.name}" returned HTTP ${status}.`);
        break;
    }
  }

  /** Execute configured assessment/authorisation steps until approval, a durable wait, or implementation is reached. */
  async continueLifecycle(changeId: number): Promise<void> {
    const s = await this.cfg.effective();
    const c = await this.findOne(changeId);
    const progress = await this.lifecycleProgress(changeId);
    if (progress) {
      c.lifecycleSteps = progress.lifecycleSteps;
      c.lifecycleStepIndex = progress.lifecycleStepIndex;
      c.lifecycleWaitUntil = progress.lifecycleWaitUntil;
    }
    if (c.state === "New") {
      this.setState(c, "Assess");
      await this.persist(c);
    }
    const steps = this.lifecycleSteps(c, s);
    let index = c.lifecycleStepIndex ?? 0;
    while (index < steps.length) {
      const step = steps[index], type = stepType(step);
      if (type === "implement") {
        if (await this.approvals.count({ where: { change: { changeId: c.changeId }, status: "Approved" } })) {
          await this.notifier.notify("e4", c.changeId);
        }
        c.lifecycleStepIndex = index + 1;
        c.lifecycleWaitUntil = null;
        this.setState(c, "Scheduled");
        await this.persist(c);
        return;
      }
      if (type === "review" || type === "close") {
        c.lifecycleStepIndex = index;
        await this.persist(c);
        return;
      }
      if (type === "condition") {
        const conflicts = await this.conflictsFor(c, s);
        const skip = (condMet(step, this.attrsOf(c, conflicts.some((x) => x.kind === "Change")))) ? step.yes === "skip" : step.no === "skip";
        index += skip ? 2 : 1;
        c.lifecycleStepIndex = index;
        await this.persist(c);
        continue;
      }
      if (type === "gate") {
        index += 1;
        c.lifecycleStepIndex = index;
        await this.persist(c);
        continue;
      }
      if (type === "wait") {
        if (c.lifecycleWaitUntil && c.lifecycleWaitUntil > new Date()) {
          c.lifecycleStepIndex = index + 1;
          this.setState(c, "Assess");
          await this.persist(c);
          return;
        }
        if (!c.lifecycleWaitUntil) {
          const minutes = Math.max(1, step.waitMinutes ?? 1);
          c.lifecycleWaitUntil = new Date(Date.now() + minutes * 60000);
          c.lifecycleStepIndex = index + 1;
          this.setState(c, "Assess");
          await this.persist(c);
          return;
        }
        c.lifecycleWaitUntil = null;
        index += 1;
        c.lifecycleStepIndex = index;
        await this.persist(c);
        continue;
      }
      if (["policy", "individual", "group", "role", "parallel", "cabAgenda"].includes(type)) {
        const conflicts = await this.conflictsFor(c, s);
        const path = approvalPath(s, c.changeType, c.riskLevel, c.category, this.attrsOf(c, conflicts.some((x) => x.kind === "Change")), step.id, steps);
        if (path.length) {
          const highest = await this.approvals.createQueryBuilder("a").select("MAX(a.stage)", "max").where("a.change_id = :cid", { cid: c.changeId }).getRawOne<{ max: number | null }>();
          const startStage = Number(highest?.max ?? 0) + 1;
          await this.buildApprovals(c, path, s, startStage);
          c.lifecycleStepIndex = index + 1;
          this.setState(c, "Authorize");
          await this.persist(c);
          await this.notifier.notify(baseOf(s, c.changeType) === "Emergency" ? "e7" : "e2", c.changeId);
          return;
        }
        index += 1;
        c.lifecycleStepIndex = index;
        await this.persist(c);
        continue;
      }
      await this.executeLifecycleAction(c, step);
      index += 1;
      c.lifecycleStepIndex = index;
      await this.persist(c);
    }
    this.setState(c, "Scheduled");
    c.lifecycleStepIndex = index;
    c.lifecycleWaitUntil = null;
    await this.persist(c);
  }

  async resumeDueLifecycle(changeId: number): Promise<void> {
    const c = await this.lifecycleProgress(changeId);
    if (!c || !["Assess", "Authorize"].includes(c.state)) return;
    if (c.lifecycleWaitUntil && c.lifecycleWaitUntil > new Date()) return;
    if ((await this.approvals.count({ where: { change: { changeId }, status: "Pending" } })) > 0) return;
    c.lifecycleWaitUntil = null;
    await this.persist(c);
    await this.continueLifecycle(changeId);
  }

  async remove(changeId: number): Promise<void> {
    const c = await this.findOne(changeId);
    if (c.state !== "New") throw new BadRequestException("Only draft changes can be deleted; cancel the change instead.");
    await this.repo.remove(c);
  }

  // ───────── lifecycle ─────────
  /** New → Authorize (approvals requested), or straight to Scheduled when the lifecycle needs no approval. */
  async submit(changeId: number, actor: Actor): Promise<Change> {
    const s = await this.cfg.effective();
    const c = await this.findOne(changeId);
    if (c.state !== "New") throw new BadRequestException("Only a draft change can be submitted.");
    const base = baseOf(s, c.changeType), model = modelFor(s, c.changeType);
    const missing: string[] = [];
    if (!c.shortDescription) missing.push("short description");
    if (!c.description) missing.push("description");
    if (!c.businessService) missing.push("affected business service");
    if (!c.plannedStart || !c.plannedEnd) missing.push("planned start and end");
    if (base === "Standard") {
      const t = s.templates.find((x) => x.id === c.templateId);
      if (!t) missing.push("an authorised standard change template");
      else if (t.status !== "Active") throw new BadRequestException(`Template "${t.name}" is ${t.status.toLowerCase()} and cannot be used for new changes.`);
    } else {
      if (!c.implementationPlan) missing.push("implementation plan");
      if (!c.backoutPlan) missing.push("backout plan");
    }
    // The risk questionnaire is required when the lifecycle has a "risk assessment complete" check, or when Risk Assessment → Settings says this model needs one.
    const rs = s.risk.settings;
    const riskNeeded = base !== "Standard" && (gatesOf(s, c.changeType).includes("risk") || (rs.requiredFor.includes(c.changeType) && !(base === "Emergency" && rs.emgAfter)));
    if (riskNeeded) { const r = scoreRisk(s, c.riskAnswers, c.changeType, c.category); if (!r.complete) missing.push(`risk assessment (still to answer: ${r.missing.length})`); }
    const gates = gatesOf(s, c.changeType);
    if (gates.includes("plans") && (!c.implementationPlan || !c.backoutPlan || !c.testPlan)) missing.push("implementation, backout and test plans");
    if (gates.includes("cis") && !c.configurationItems?.length) missing.push("at least one configuration item");
    if (gates.includes("incident") && !c.relatedRecords?.some((r) => r.kind === "Incident") && !missing.includes("related incident")) missing.push("related incident");
    if (model?.linkIncident && !c.relatedRecords?.some((r) => r.kind === "Incident")) missing.push("related incident");
    if (missing.length) throw new BadRequestException(`Complete before submitting: ${missing.join(", ")}.`);
    if (model?.leadDays && c.plannedStart && c.plannedStart.getTime() < Date.now() + model.leadDays * 86400000) {
      throw new BadRequestException(`${c.changeType} changes need ${model.leadDays} days' notice — move the planned start later, or raise an Emergency change.`);
    }
    const conflicts = await this.conflictsFor(c, s);
    const blackout = conflicts.find((x) => x.kind === "Blackout");
    if (blackout) throw new BadRequestException(blackout.text);
    if (gates.includes("conflict") && conflicts.some((x) => x.kind === "Change")) throw new BadRequestException(`This lifecycle does not allow a clash with another change. ${conflicts.find((x) => x.kind === "Change")!.text}`);
    await this.checkWorkgroup(c.assignmentGroup);

    c.lifecycleSteps = JSON.parse(JSON.stringify(lifecycleOf(s, c.changeType).steps)) as LifecycleStep[];
    c.lifecycleStepIndex = 0;
    c.lifecycleWaitUntil = null;
    await this.persist(c);
    await this.continueLifecycle(c.changeId);
    await this.addNote(c.changeId, `Change submitted by ${actor.username}.`, actor);

    if (c.templateId) await this.cfg.patch("templates", (t) => t.map((x) => (x.id === c.templateId ? { ...x, uses: x.uses + 1 } : x)));
    await this.notifier.notify("e1", changeId);
    if (conflicts.some((x) => x.kind === "Change")) await this.notifier.notify("e14", changeId);
    return this.findOne(changeId);
  }

  /** Pending approvals in the open stage of changes awaiting authorisation (with the change, requester and owner loaded). */
  private openStageRows() {
    return this.approvals.createQueryBuilder("a")
      .innerJoinAndSelect("a.change", "change").leftJoinAndSelect("change.requestedBy", "requestedBy").leftJoinAndSelect("change.assignedTo", "assignedTo")
      .leftJoinAndSelect("a.approver", "approver")
      .where("a.status = 'Pending'").andWhere("change.state = 'Authorize'")
      .andWhere(`a.stage = (SELECT MIN(p.stage) FROM change_approvals p WHERE p.change_id = a.change_id AND p.status = 'Pending')`)
      .orderBy("change.plannedStart", "ASC");
  }
  private isOwn(a: ChangeApproval, actor: Actor) { return a.change.requestedBy?.userId === actor.userId || a.change.assignedTo?.userId === actor.userId; }

  /** Is this row the signed-in user's to decide? Named approvers decide their own row; an unassigned row belongs to the group's members and change staff; administrators may act for anyone. */
  private canDecide(a: ChangeApproval, actor: Actor, s: ChangeSettings): boolean {
    if (isAdminActor(actor)) return true;
    if (a.approver) return a.approver.userId === actor.userId;
    return isStaff(actor.roles) || !!activeGroup(s, a.approvalGroup)?.members.some((m) => m.userId === actor.userId);
  }

  /** Pending approvals the signed-in user can act on (the open stage only). */
  async myApprovals(actor: Actor): Promise<ChangeApproval[]> {
    const s = await this.cfg.effective();
    const rows = await this.openStageRows().getMany();
    // You never get your own change in your queue when self-approval is blocked.
    return rows.filter((a) => this.canDecide(a, actor, s) && !this.isOwn(a, actor));
  }

  /** Changes waiting for approval that the signed-in user raised or owns: shown so "nothing to approve" is explained when self-approval is blocked. */
  async blockedApprovals(actor: Actor) {
    const s = await this.cfg.effective();
    const rows = (await this.openStageRows().getMany()).filter((a) => this.isOwn(a, actor) && this.canDecide(a, actor, s));
    const seen = new Set<number>();
    return rows.filter((a) => !seen.has(a.change.changeId) && seen.add(a.change.changeId)).map((a) => ({ changeId: a.change.changeId, changeCode: a.change.changeCode, shortDescription: a.change.shortDescription, approvalGroup: a.approvalGroup }));
  }

  private stageSatisfied(rows: ChangeApproval[]): boolean {
    const live = rows.filter((r) => r.status !== "Not required");
    const ok = live.filter((r) => r.status === "Approved").length;
    const rule = (live[0]?.rule ?? "Any one member") as ApprovalRuleText;
    if (!live.length) return true;
    return rule === "All members" ? ok === live.length : rule === "Majority of members" ? ok > live.length / 2 : ok >= 1;
  }

  async decide(approvalId: number, dto: ApprovalDecisionDto, actor: Actor): Promise<Change> {
    const s = await this.cfg.effective();
    const a = await this.approvals.findOne({ where: { id: approvalId }, relations: { change: true, approver: true } });
    if (!a) throw new NotFoundException("Approval not found");
    if (a.status !== "Pending") throw new BadRequestException("This approval has already been decided.");
    if (!this.canDecide(a, actor, s)) throw new ForbiddenException(a.approver ? "This approval is assigned to someone else." : "You are not an approver for this stage.");
    if (dto.decision === "Rejected" && !dto.comment?.trim()) throw new BadRequestException("A comment is required to reject a change.");

    const c = await this.findOne(a.change.changeId);
    if ((c.requestedBy?.userId === actor.userId || c.assignedTo?.userId === actor.userId)) {
      throw new ForbiddenException("You cannot approve a change you requested or own.");
    }
    if (c.state !== "Authorize") throw new BadRequestException("This change is not awaiting approval.");
    const open = c.approvals?.filter((x) => x.status === "Pending") ?? [];
    if (open.length && Math.min(...open.map((x) => x.stage)) !== a.stage) throw new BadRequestException("An earlier approval stage is still pending.");

    const onBehalf = a.approver && a.approver.userId !== actor.userId ? this.fullName(a.approver) : "";
    a.status = dto.decision; a.comment = dto.comment; a.decidedAt = new Date();
    a.approver = (await this.userById(actor.userId)) ?? a.approver;
    await this.approvals.save(a);
    if (onBehalf) await this.addNote(c.changeId, `${actor.username} (administrator) recorded this decision on behalf of ${onBehalf}.`, actor);
    await this.afterDecision(c, a, dto.decision, dto.comment, this.fullName(a.approver), s, actor);
    return this.findOne(c.changeId);
  }

  /** Apply a recorded decision: reject the change, or advance when the stage's rule is satisfied. */
  private async afterDecision(c: Change, a: ChangeApproval, decision: "Approved" | "Rejected", comment: string | undefined, who: string, s: ChangeSettings, actor: Actor) {
    if (decision === "Rejected") {
      await this.closeOpenRows(c.changeId);
      this.setState(c, "Cancelled"); c.closeCode = "Rejected"; c.closeNotes = comment;
      await this.persist(c);
      await this.addNote(c.changeId, `${a.approvalGroup} rejected the change${comment ? `: ${comment}` : "."}`, actor);
      await this.notifier.notify("e5", c.changeId, { approver: who, comments: comment });
      return;
    }
    const stageRows = await this.approvals.find({ where: { change: { changeId: c.changeId }, stage: a.stage } });
    if (this.stageSatisfied(stageRows)) {
      await this.closeOpenRows(c.changeId, a.stage);
      await this.addNote(c.changeId, `${a.approvalGroup} approved the change${comment ? `: ${comment}` : "."}`, actor);
      const remaining = await this.approvals.count({ where: { change: { changeId: c.changeId }, status: "Pending" } });
      if (remaining === 0) {
        const progress = await this.lifecycleProgress(c.changeId);
        const resumeLifecycle = Array.isArray(progress?.lifecycleSteps) && progress.lifecycleStepIndex !== null && progress.lifecycleStepIndex !== undefined;
        if (!resumeLifecycle) this.setState(c, "Scheduled");
        await this.persist(c);
        if (resumeLifecycle) await this.continueLifecycle(c.changeId);
        else await this.notifier.notify("e4", c.changeId, { approver: who, comments: comment });
      } else await this.notifier.notify("e2", c.changeId);   // next stage requested
    } else {
      await this.addNote(c.changeId, `${who} approved for ${a.approvalGroup}${comment ? `: ${comment}` : "."}`, actor);
    }
  }

  /** A board decides a whole stage at once (CAB meeting): one decision, recorded by the person running the meeting. */
  async decideStage(changeId: number, group: string, decision: "Approved" | "Rejected", comment: string | undefined, actor: Actor, meetingId: number): Promise<Change> {
    const s = await this.cfg.effective();
    if (decision === "Rejected" && !comment?.trim()) throw new BadRequestException("A comment is required to reject a change.");
    const c = await this.findOne(changeId);
    if (c.state !== "Authorize") throw new BadRequestException("This change is not awaiting approval.");
    const open = c.approvals?.filter((x) => x.status === "Pending") ?? [];
    const stage = open.length ? Math.min(...open.map((x) => x.stage)) : 0;
    const rows = open.filter((x) => x.stage === stage && x.approvalGroup === group);
    if (!rows.length) throw new BadRequestException(`${group} is not the open approval stage for this change.`);
    const lead = rows[0];
    lead.status = decision; lead.comment = comment; lead.decidedAt = new Date(); lead.meetingId = meetingId;
    lead.approver = (await this.userById(actor.userId)) ?? lead.approver;
    await this.approvals.save(lead);
    if (decision === "Approved") await this.closeOpenRows(changeId, stage);
    await this.afterDecision(c, lead, decision, comment, this.fullName(lead.approver), s, actor);
    await this.notifier.notify("e9", changeId, { approver: this.fullName(lead.approver), comments: comment });
    return this.findOne(changeId);
  }

  /** Approver asks the owner a question; recorded as a work note and e-mailed. The approval stays pending. */
  async requestInfo(changeId: number, comment: string, actor: Actor): Promise<Change> {
    if (!comment?.trim()) throw new BadRequestException("Say what information you need.");
    const c = await this.findOne(changeId);
    const isApprover = (c.approvals ?? []).some((a) => a.status === "Pending" && (a.approver?.userId === actor.userId || (!a.approver && isStaff(actor.roles))));
    if (!isApprover && !isStaff(actor.roles)) throw new ForbiddenException("Only an approver can ask for more information.");
    const me = await this.userById(actor.userId);
    await this.addNote(changeId, `More information requested by ${this.fullName(me)}: ${comment.trim()}`, actor);
    await this.notifier.notify("e6", changeId, { approver: this.fullName(me), comments: comment.trim() });
    return this.findOne(changeId);
  }

  async startImplementation(changeId: number, actor: Actor): Promise<Change> {
    this.requireStaff(actor);
    const c = await this.findOne(changeId);
    if (c.state !== "Scheduled") throw new BadRequestException("Only an authorised, scheduled change can be implemented.");
    c.actualStart = new Date();
    this.setState(c, "Implement");
    await this.persist(c);
    await this.addNote(changeId, "Implementation started.", actor);
    await this.notifier.notify("e11", changeId);
    return this.findOne(changeId);
  }

  async completeImplementation(changeId: number, dto: CompleteImplementationDto, actor: Actor): Promise<Change> {
    this.requireStaff(actor);
    const s = await this.cfg.effective();
    const c = await this.findOne(changeId);
    if (c.state !== "Implement") throw new BadRequestException("The change is not being implemented.");
    c.implementationOutcome = dto.outcome;
    c.implementationNotes = dto.notes;
    c.actualEnd = dto.actualEnd ? new Date(dto.actualEnd) : new Date();
    if (c.actualStart && c.actualEnd < c.actualStart) throw new BadRequestException("Actual end cannot be before actual start.");
    const failed = FAILED_OUTCOMES.includes(dto.outcome);

    // A lifecycle without a Review step closes straight away — unless the outcome makes a review mandatory
    // (e.g. a failed standard change), in which case it still goes to Review.
    const toReview = hasStep(s, c.changeType, "Review") || pirRequired(s, c.changeType, c.riskLevel, dto.outcome);
    if (toReview) {
      this.setState(c, "Review");
    } else {
      const want = CODE_FOR_OUTCOME[dto.outcome];
      const code = s.closeCodes.find((x) => x.active && x.name === want) ?? s.closeCodes.find((x) => x.active && x.name !== "Cancelled");
      c.closeCode = code?.name; this.setState(c, "Closed");
    }
    await this.persist(c);
    await this.addNote(changeId, `Implementation completed: ${dto.outcome}.`, actor);
    if (failed) {
      await this.notifier.notify("e13", changeId);
      if (c.templateId) await this.cfg.patch("templates", (t) => t.map((x) => (x.id === c.templateId ? { ...x, failed: x.failed + 1, status: "Under review" as const } : x)));   // a failed standard change pulls its template for review
    }
    await this.notifier.notify(toReview ? "e15" : "e16", changeId);
    return this.findOne(changeId);
  }

  async savePir(changeId: number, dto: SavePirDto, actor: Actor): Promise<Change> {
    this.requireStaff(actor);
    const c = await this.findOne(changeId);
    if (c.state !== "Review") throw new BadRequestException("A post-implementation review is recorded while the change is in Review.");
    c.pir = { ...dto } as Record<string, string>;
    await this.persist(c);
    return this.findOne(changeId);
  }

  async close(changeId: number, dto: CloseChangeDto, actor: Actor): Promise<Change> {
    this.requireStaff(actor);
    const s = await this.cfg.effective();
    const c = await this.findOne(changeId);
    if (c.state !== "Review") throw new BadRequestException("Only a change in Review can be closed.");
    const code = s.closeCodes.find((x) => x.active && x.name === dto.closeCode && x.name !== "Cancelled");
    if (!code) throw new BadRequestException("Choose a valid close code.");
    if (baseOf(s, c.changeType) !== "Standard" && !c.riskLevel) throw new BadRequestException("Risk must be assessed before this change can be closed.");
    if (pirRequired(s, c.changeType, c.riskLevel, c.implementationOutcome, code.name) && !c.pir) {
      throw new BadRequestException("A post-implementation review is required before closing this change.");
    }
    c.closeCode = dto.closeCode; c.closeNotes = dto.closeNotes;
    this.setState(c, "Closed");
    await this.persist(c);
    await this.addNote(changeId, `Change closed (${dto.closeCode}).`, actor);
    await this.notifier.notify("e16", changeId);
    return this.findOne(changeId);
  }

  async cancel(changeId: number, reason: string | undefined, actor: Actor): Promise<Change> {
    this.requireStaff(actor);
    const c = await this.findOne(changeId);
    if (!EDITABLE.includes(c.state)) throw new BadRequestException("A change under implementation can no longer be cancelled.");
    c.closeCode = "Cancelled"; c.closeNotes = reason;
    this.setState(c, "Cancelled");
    await this.closeOpenRows(changeId);
    await this.persist(c);
    await this.addNote(changeId, `Change cancelled${reason ? `: ${reason}` : "."}`, actor);
    await this.notifier.notify("e17", changeId, { comments: reason });
    return this.findOne(changeId);
  }

  // ───────── preview, schedule, overview ─────────
  /** Risk, priority, approval path and conflicts for a draft — drives the live summary on Create Change. */
  async preview(dto: PreviewChangeDto) {
    const s = await this.cfg.effective();
    const type = dto.changeType ?? s.models.find((m) => m.base === "Normal" && m.active)?.name ?? "Normal";
    const draft = this.repo.create({
      changeId: dto.changeId, changeType: type, state: "New", category: dto.category, businessService: dto.businessService, configurationItems: dto.configurationItems ?? [],
      riskAnswers: dto.riskAnswers ?? {}, impact: dto.impact, urgency: dto.urgency, causesOutage: !!dto.causesOutage,
      plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : undefined, plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : undefined,
    });
    this.applyRisk(draft, s);
    const lead = modelFor(s, type)?.leadDays ?? 0;
    const conflicts = await this.conflictsFor(draft, s);
    const path = approvalPath(s, type, draft.riskLevel, dto.category, this.attrsOf(draft, conflicts.some((x) => x.kind === "Change")));
    const r = scoreRisk(s, draft.riskAnswers, type, dto.category);
    return {
      risk: { score: draft.riskScore ?? null, level: draft.riskLevel ?? null, answered: r.answered, total: r.total, complete: r.complete, max: r.max, floors: r.floors, visible: r.visible, sections: r.sections, base: r.base || null },
      priority: derivePriority(dto.impact, dto.urgency) ?? null,
      approvalPath: await Promise.all(path.map(async (p) => ({ ...p, members: (await this.stageMembers(p, draft, s)).length }))),
      conflicts,
      defaultGroup: categoryGroup(s, dto.category) || null,
      leadDays: lead,
      leadTimeOk: !lead || !draft.plannedStart || draft.plannedStart.getTime() >= Date.now() + lead * 86400000,
    };
  }

  /** Forward schedule of change: changes planned in [from, to], their conflicts, and the blackout/maintenance windows in force. */
  async schedule(from: string, to: string, actor: Actor) {
    this.requireStaff(actor);
    const s = await this.cfg.effective();
    const f = new Date(from), t = new Date(to);
    if (isNaN(+f) || isNaN(+t) || t <= f) throw new BadRequestException("Choose a valid date range.");
    const windows = s.windows.filter((w) => w.active);
    const changes = (await this.findAll({ from, to }, actor)).filter((c) => c.state !== "Cancelled" && c.plannedStart && c.plannedEnd
      && !(c.state === "Closed" && c.plannedStart > new Date())); // closed before its window: never shown as upcoming
    const live = await this.liveChanges();
    return {
      changes: changes.map((c) => Object.assign(c, { conflicts: c.state === "Closed" ? [] : findConflicts(c, live, windows) })),
      windows: windows.flatMap((w) => windowIntervals(w, f, t).map((i) => ({ id: w.id, name: w.name, kind: w.kind, scope: w.scope, start: i.start, end: i.end }))),
    };
  }

  /** Dashboard numbers for the Change Overview screen. */
  async overview(actor: Actor) {
    const s = await this.cfg.effective();
    const now = new Date(), in7 = new Date(+now + 7 * 86400000), ago30 = new Date(+now - 30 * 86400000);
    const rows = await this.findAll({}, actor);
    const open = rows.filter((c) => OPEN.includes(c.state));
    const live = await this.liveChanges();
    const windows = s.windows.filter((w) => w.active);
    const pending = open.length ? await this.approvals.find({ where: { change: { changeId: In(open.map((c) => c.changeId)) }, status: "Pending" }, relations: { change: true } }) : [];
    const recent = rows.filter((c) => c.createdAt >= ago30);
    const emergencies = recent.filter((c) => baseOf(s, c.changeType) === "Emergency").length;
    const upcoming = open.filter((c) => LIVE.includes(c.state) && c.plannedStart && c.plannedStart <= in7 && (c.plannedEnd ?? c.plannedStart) >= now)
      .sort((a, b) => +a.plannedStart! - +b.plannedStart!);

    const attention: { kind: string; changeId: number; changeCode: string; title: string; text: string; order: number }[] = [];
    for (const c of open) {
      const item = (kind: string, text: string, order: number) => attention.push({ kind, changeId: c.changeId, changeCode: c.changeCode, title: c.shortDescription, text, order });
      const cf = LIVE.includes(c.state) && c.plannedStart ? findConflicts(c, live, windows).filter((x) => x.kind !== "Maintenance") : [];
      if (cf.length) item("Conflict", cf[0].text, 0);
      if (c.state === "Authorize") { const p = pending.filter((x) => x.change.changeId === c.changeId).sort((a, b) => a.stage - b.stage)[0]; item("Approval", `Waiting on ${p?.approvalGroup ?? "review"}`, 1); }
      if (c.state === "Review") item("Review due", `Implemented: ${c.implementationOutcome ?? "outcome recorded"}. Review before closing.`, 2);
      if (c.state === "Implement" && c.plannedEnd && c.plannedEnd < now) item("Overrun", "The planned end has passed.", 0);
      if (c.state === "New" && !c.riskLevel && baseOf(s, c.changeType) === "Normal") item("Draft", "Risk assessment not completed yet.", 3);
    }
    attention.sort((a, b) => a.order - b.order);

    const states: ChangeState[] = ["New", "Assess", "Authorize", "Scheduled", "Implement", "Review"];
    const levels = ["Low", "Moderate", "High", "Very High"];
    const closed = rows.filter((c) => c.state === "Closed");
    return {
      tiles: {
        open: open.length, awaitingDecision: open.filter((c) => ["Assess", "Authorize"].includes(c.state)).length,
        goingLive: upcoming.length, inReview: open.filter((c) => c.state === "Review").length,
        emergencyShare: recent.length ? Math.round((emergencies / recent.length) * 100) : null, emergencies, recent: recent.length,
      },
      attention: attention.slice(0, 8), attentionCount: attention.length,
      upcoming: upcoming.slice(0, 10),
      byState: states.map((st) => ({ state: st, count: open.filter((c) => c.state === st).length })),
      typeRisk: { levels, rows: s.models.filter((m) => m.active || open.some((c) => c.changeType === m.name)).map((m) => ({ type: m.name, counts: levels.map((lv) => open.filter((c) => c.changeType === m.name && c.riskLevel === lv).length), unassessed: open.filter((c) => c.changeType === m.name && !c.riskLevel).length })) },
      outcomes: s.closeCodes.map((cc) => ({ code: cc.name, count: closed.filter((c) => c.closeCode === cc.name).length })).filter((o) => o.count),
    };
  }

  /** Test run for the lifecycle screen: what path would a change of this model and risk take? */
  async simulate(changeType: string, risk: string | undefined, category: string | undefined, attrs: ChangeAttrs = {}, lifecycleId?: string) {
    const saved = await this.cfg.effective();
    const model = modelFor(saved, changeType);
    if (!model) throw new BadRequestException("Unknown change model.");
    if (lifecycleId && !saved.lifecycles.some((l) => l.id === lifecycleId)) throw new BadRequestException("Save the lifecycle before running a test.");
    // Try another lifecycle for this model without changing any saved setting.
    const s: ChangeSettings = lifecycleId ? { ...saved, models: saved.models.map((m) => (m.name === changeType ? { ...m, lifecycle: lifecycleId } : m)) } : saved;
    const lc = s.lifecycles.find((l) => l.id === modelFor(s, changeType)!.lifecycle);
    const executionPlan: { stepId: string; name: string; type: ReturnType<typeof stepType>; detail: string }[] = [];
    let skipNext = false;
    for (const step of lc?.steps ?? []) {
      if (skipNext) { skipNext = false; continue; }
      const type = stepType(step);
      if (type === "condition") {
        const matched = condMet(step, { ...attrs, type: changeType, risk: baseOf(s, changeType) === "Standard" ? "Low" : risk ?? "", category: category ?? "" });
        const branch = matched ? step.yes : step.no;
        executionPlan.push({ stepId: step.id, name: step.name, type, detail: `Condition ${matched ? "matched" : "did not match"}; ${branch === "skip" ? "skips the next step" : "continues"}.` });
        skipNext = branch === "skip";
        continue;
      }
      if (["policy", "individual", "group", "role", "parallel", "cabAgenda"].includes(type)) {
        const stages = approvalPath(s, changeType, risk, category, attrs, step.id, lc?.steps);
        executionPlan.push({ stepId: step.id, name: step.name, type, detail: stages.length ? stages.map((stage) => stage.group).join(", ") : "No approvers configured; continues." });
      } else {
        const detail = type === "wait" ? `Wait ${step.waitMinutes ?? 0} minutes.`
          : type === "email" ? `Send e-mail to ${(step.recipients ?? []).join(", ")}.`
          : type === "update" ? `Set ${step.updateField ?? "field"} to “${step.updateValue ?? ""}”.`
          : type === "task" ? `Create task “${step.taskName ?? ""}”.`
          : type === "record" ? `Create related ${step.recordType ?? "record"} “${step.recordTitle ?? ""}”.`
          : type === "integration" ? "Call configured public HTTPS endpoint."
          : type === "gate" ? `Check ${step.gate ?? "configured requirement"}.`
          : type === "implement" ? "Wait for implementation to be recorded."
          : type === "review" ? "Record the post-implementation review."
          : type === "close" ? "Close with a close code."
          : "Continue.";
        executionPlan.push({ stepId: step.id, name: step.name, type, detail });
      }
    }
    return {
      model: model.name, lifecycle: lc?.name ?? null, steps: lc?.steps ?? [],
      approvalPath: approvalPath(s, changeType, baseOf(s, changeType) === "Standard" ? "Low" : risk, category, attrs).map((p) => ({ ...p, members: p.userId ? 1 : p.role ? 0 : activeGroup(s, p.group)?.members.length ?? 0 })),
      gates: gatesOf(s, changeType),
      leadDays: model.leadDays,
      reviewRequired: pirRequired(s, changeType, risk, undefined),
      executionPlan,
    };
  }

  // ───────── tasks & notes ─────────
  async addTask(changeId: number, dto: CreateChangeTaskDto, actor: Actor): Promise<Change> {
    this.requireStaff(actor);
    const c = await this.findOne(changeId);
    if (TERMINAL.includes(c.state)) throw new BadRequestException("Tasks cannot be added to a closed change.");
    const n = (await this.tasks.count({ where: { change: { changeId } } })) + 1;
    await this.tasks.save(this.tasks.create({
      change: c, taskCode: `${c.changeCode}-T${n}`, shortDescription: dto.shortDescription,
      assignmentGroup: dto.assignmentGroup, assignedTo: await this.userById(dto.assignedToId),
    }));
    return this.findOne(changeId);
  }

  async updateTask(changeId: number, taskId: number, dto: UpdateChangeTaskDto, actor: Actor): Promise<Change> {
    this.requireStaff(actor);
    const t = await this.tasks.findOne({ where: { id: taskId, change: { changeId } } });
    if (!t) throw new NotFoundException("Task not found");
    const { assignedToId, state, ...rest } = dto;
    Object.assign(t, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)));
    if (state) t.state = state as ChangeTask["state"];
    if (assignedToId !== undefined) t.assignedTo = await this.userById(assignedToId);
    await this.tasks.save(t);
    return this.findOne(changeId);
  }

  async addNote(changeId: number, note: string, actor?: Actor): Promise<ChangeWorkNote> {
    return this.notes.save(this.notes.create({ change: { changeId } as Change, note, author: await this.userById(actor?.userId) }));
  }
}
