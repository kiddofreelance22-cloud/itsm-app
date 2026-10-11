import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Incident } from "../incidents/entities/incident.entity";
import { Category } from "../categories/entities/category.entity";
import { Priority } from "../priority/entities/priority.entity";
import { Classification } from "./entities/classification.entity";
import { StatusTransition } from "./entities/status-transition.entity";
import { MandatoryFieldRule } from "./entities/mandatory-field-rule.entity";
import { ApprovalRule } from "./entities/approval-rule.entity";
import { IncidentApproval } from "./entities/incident-approval.entity";
import { SlaMatrixEntry } from "./entities/sla-matrix.entity";
import { OnHoldReason } from "./entities/on-hold-reason.entity";
import { NotificationService } from "./notification.service";
import { WoChecklistItem } from "./entities/wo-checklist-item.entity";
import { IncidentChecklist } from "./entities/incident-checklist.entity";
import { ResolutionCode } from "./entities/resolution-code.entity";
import { IncidentChecklistProgress, LogIncidentField } from "./entities/incident-record.entities";
import { WorkOrder } from "./entities/work-order.entity";
import { WorkgroupSlaWindow } from "./entities/workgroup-sla-window.entity";
import { SlaServiceWindow } from "../request-masters/entities/sla-service-window.entity";
import { addBusinessMinutes, ianaZone } from "../../common/utils/business-time.util";
import { PriorityMatrix } from "../request-masters/entities/priority-matrix.entity";
import { PendingReason } from "../request-masters/entities/pending-reason.entity";

export type LifecycleAction = "Resolve" | "Close" | "Reopen";

/** The subset of an update that the rules look at (all optional = unchanged). */
export interface IncidentPatch {
  status?: string; priority?: string; urgency?: string; impact?: string;
  categoryId?: number; assignedTo?: number | null; groupId?: number | null;
  resolutionNotes?: string | null; closureCode?: string | null; feedbackRating?: number | null;
  pendingReason?: string | null; classificationId?: number | null; onHoldReason?: string | null;
}

const OPEN_LIKE = ["Open", "Assigned", "In Progress", "On Hold"];

/**
 * Enforces the Configuration screens inside the incident flow:
 * Status Transition Matrix, Mandatory Field Rules, Approval Configuration,
 * SLA Matrix and On Hold Reason SLA impact. Called from IncidentsService.update().
 */
@Injectable()
export class RuleEngineService {
  constructor(
    @InjectRepository(StatusTransition) private transitions: Repository<StatusTransition>,
    @InjectRepository(MandatoryFieldRule) private mandatory: Repository<MandatoryFieldRule>,
    @InjectRepository(ApprovalRule) private approvalRules: Repository<ApprovalRule>,
    @InjectRepository(IncidentApproval) private approvals: Repository<IncidentApproval>,
    @InjectRepository(Classification) private classifications: Repository<Classification>,
    @InjectRepository(Category) private categories: Repository<Category>,
    @InjectRepository(SlaMatrixEntry) private slaMatrix: Repository<SlaMatrixEntry>,
    @InjectRepository(Priority) private priorities: Repository<Priority>,
    @InjectRepository(OnHoldReason) private onHold: Repository<OnHoldReason>,
    @InjectRepository(WoChecklistItem) private checklistItems: Repository<WoChecklistItem>,
    @InjectRepository(IncidentChecklistProgress) private checklistProgress: Repository<IncidentChecklistProgress>,
    @InjectRepository(WorkOrder) private workOrders: Repository<WorkOrder>,
    @InjectRepository(PendingReason) private pendingReasons: Repository<PendingReason>,
    @InjectRepository(LogIncidentField) private logFields: Repository<LogIncidentField>,
    @InjectRepository(WorkgroupSlaWindow) private groupWindows: Repository<WorkgroupSlaWindow>,
    @InjectRepository(SlaServiceWindow) private serviceWindows: Repository<SlaServiceWindow>,
    @InjectRepository(PriorityMatrix) private priorityMatrix: Repository<PriorityMatrix>,
    @InjectRepository(IncidentChecklist) private checklistTemplates: Repository<IncidentChecklist>,
    @InjectRepository(ResolutionCode) private resolutionCodes: Repository<ResolutionCode>,
    @InjectRepository(Incident) private incidentsRepo: Repository<Incident>,
    private notifications: NotificationService,
  ) {}

  // ── Status Transition Matrix ─────────────────────────────────────────────
  /** Statuses with no configured row (or an unconfigured `from`) are not restricted. */
  async assertTransitionAllowed(from: string, to: string): Promise<void> {
    if (from === to) return;
    const rows = await this.transitions.find({ where: { fromStatus: from } });
    if (!rows.length) return;
    const row = rows.find((r) => r.toStatus === to);
    if (!row) return; // target status not in the matrix (custom status) → don't block
    if (!row.allowed) {
      throw new BadRequestException(`Status cannot change from "${from}" to "${to}" (Status Transition Matrix).`);
    }
  }

  // ── Mandatory Field Rules ────────────────────────────────────────────────
  async assertMandatoryFields(incident: Incident, patch: IncidentPatch): Promise<void> {
    const rules = await this.mandatory.find({ where: { isActive: true }, order: { displayOrder: "ASC" } });
    if (!rules.length) return;

    const val = await this.projectedValues(incident, patch);
    const missing = new Set<string>();
    for (const rule of rules) {
      const actual = val.condition[rule.conditionField];
      if (actual === undefined || actual === null || actual === "") continue;
      if (!rule.conditionValues.some((v) => this.same(v, String(actual)))) continue;
      for (const target of rule.targetFields) {
        const v = val.target[target];
        if (v === undefined || v === null || (typeof v === "string" && !v.trim())) missing.add(target);
      }
    }
    if (missing.size) {
      throw new BadRequestException(`Cannot save: ${[...missing].join(", ")} ${missing.size > 1 ? "are" : "is"} mandatory for this incident (Mandatory Field Rules).`);
    }
  }

  private same(a: string, b: string): boolean {
    const norm = (s: string) => s.replace(/^\s*\d+\s*-\s*/, "").trim().toLowerCase(); // "1 - High" == "High"
    return norm(a) === norm(b);
  }

  private async projectedValues(i: Incident, p: IncidentPatch) {
    let categoryName = i.category?.categoryName ?? null;
    if (p.categoryId !== undefined) {
      categoryName = p.categoryId ? (await this.categories.findOne({ where: { categoryId: p.categoryId } }))?.categoryName ?? null : null;
    }
    const classificationId = p.classificationId !== undefined ? p.classificationId : i.classificationId ?? null;
    const classificationName = classificationId
      ? (await this.classifications.findOne({ where: { classificationId } }))?.name ?? null : null;
    const group = p.groupId !== undefined ? p.groupId : i.assignmentGroup?.groupId ?? null;
    const agent = p.assignedTo !== undefined ? p.assignedTo : i.assignedTo?.userId ?? null;
    return {
      condition: {
        Status: p.status ?? i.status,
        Priority: p.priority ?? i.priority,
        Category: categoryName,
        "Pending Reason": p.pendingReason !== undefined ? p.pendingReason : i.pendingReason ?? null,
        Classification: classificationName,
        Urgency: p.urgency ?? i.urgency,
        Impact: p.impact ?? i.impact,
      } as Record<string, string | null>,
      target: {
        Priority: p.priority ?? i.priority,
        Urgency: p.urgency ?? i.urgency,
        Category: categoryName,
        Classification: classificationName,
        "Pending Reason": p.pendingReason !== undefined ? p.pendingReason : i.pendingReason ?? null,
        "On Hold Reason": p.onHoldReason !== undefined ? p.onHoldReason : i.onHoldReason ?? null,
        "Assignment Group": group,
        "Assigned To": agent,
        Impact: p.impact ?? i.impact,
        "Resolution Notes": p.resolutionNotes !== undefined ? p.resolutionNotes : i.resolutionNotes ?? null,
        "Closure Code": p.closureCode !== undefined ? p.closureCode : i.closureCode ?? null,
        "Feedback / Rating": p.feedbackRating !== undefined ? p.feedbackRating : i.feedbackRating ?? null,
      } as Record<string, unknown>,
    };
  }

  // ── Approval Configuration ───────────────────────────────────────────────
  lifecycleAction(from: string, to: string): LifecycleAction | null {
    if (to === "Resolved") return "Resolve";
    if (to === "Closed") return "Close";
    if (["Resolved", "Closed"].includes(from) && OPEN_LIKE.includes(to)) return "Reopen";
    return null;
  }

  /**
   * Throws unless every matching approval rule has an Approved, unconsumed request.
   * A missing request is created (Pending) and the caller gets a 409 telling the user so.
   * Returns the approvals to mark consumed once the action has actually been saved.
   */
  async assertApproval(incident: Incident, action: LifecycleAction, actorId?: number): Promise<IncidentApproval[]> {
    const candidates = await this.approvalRules.find({ where: { action, isActive: true }, order: { displayOrder: "ASC" } });
    const flags = await Promise.all(candidates.map((r) => this.ruleMatches(r, incident)));
    const rules = candidates.filter((_, idx) => flags[idx]);
    if (!rules.length) return [];

    const types = [...new Set(rules.map((r) => r.approvalType))];
    const used: IncidentApproval[] = [];
    const waiting: string[] = [];
    for (const approvalType of types) {
      const existing = await this.approvals.find({
        where: { incident: { incidentId: incident.incidentId }, action, approvalType },
        order: { requestedAt: "DESC" },
      });
      const ok = existing.find((a) => a.status === "Approved" && !a.consumedAt);
      if (ok) { used.push(ok); continue; }
      if (!existing.some((a) => a.status === "Pending")) {
        await this.approvals.save(this.approvals.create({
          incident, approvalType, action, status: "Pending",
          requestedBy: actorId ? ({ userId: actorId } as any) : null,
        }));
        void this.notifications.dispatch("approvalRequested", incident);
      }
      waiting.push(approvalType);
    }
    if (waiting.length) {
      throw new ConflictException(
        `${action} requires ${waiting.join(" and ")}. A request has been sent to Approve Incident Records; try again once it is approved.`,
      );
    }
    return used;
  }

  async consume(approvals: IncidentApproval[]): Promise<void> {
    if (!approvals.length) return;
    const now = new Date();
    await this.approvals.save(approvals.map((a) => Object.assign(a, { consumedAt: now })));
  }

  private async ruleMatches(rule: ApprovalRule, i: Incident): Promise<boolean> {
    if (rule.conditionField === "Any Incident") return true;
    let actual: string | null | undefined;
    if (rule.conditionField === "Priority") actual = i.priority;
    else if (rule.conditionField === "Impact") actual = i.impact;
    else if (rule.conditionField === "Category") actual = i.category?.categoryName;
    else if (rule.conditionField === "Classification" && i.classificationId) {
      actual = (await this.classifications.findOne({ where: { classificationId: i.classificationId } }))?.name;
    }
    return !!actual && rule.conditionValues.some((v) => this.same(v, String(actual)));
  }

  // ── SLA overrides ────────────────────────────────────────────────────────
  /** Workgroup+Priority override from the SLA Matrix, or null to use the Priority default. */
  async resolveSlaOverride(groupId: number | undefined | null, priorityName: string) {
    if (!groupId) return null;
    const prio = await this.priorities.findOne({ where: { priorityName } });
    if (!prio) return null;
    const row = await this.slaMatrix.findOne({ where: { group: { groupId }, priority: { priorityId: prio.priorityId }, isActive: true } });
    return row ? { responseMinutes: row.responseMinutes, resolutionMinutes: row.resolutionMinutes } : null;
  }


  // ── Incident checklist + resolve gates ───────────────────────────────────
  /** Synthetic (negative) progress id for task `index` of checklist template `templateId`. */
  static templateTaskId(templateId: number, index: number): number { return -(templateId * 1000 + index + 1); }

  /** Is `categoryId` the template's category, or (when asked) one of its descendants? */
  private async categoryMatches(tpl: IncidentChecklist, categoryId: number | null): Promise<boolean> {
    if (!tpl.categoryId) return true;
    if (!categoryId) return false;
    if (tpl.categoryId === categoryId) return true;
    if (!tpl.includeSubCategories) return false;
    let cur: number | null = categoryId; const seen = new Set<number>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const c = await this.categories.findOne({ where: { categoryId: cur } });
      cur = c?.parentCategoryId ?? null;
      if (cur === tpl.categoryId) return true;
    }
    return false;
  }

  /**
   * Checklist for an incident = the global "Incident Work Order Checklist" items, plus the tasks of every active
   * Checklist template whose Workgroup / Status / Category scope matches this incident (an empty scope matches all).
   */
  async checklistFor(incidentId: string) {
    try {
      const items = await this.checklistItems.find({ where: { isActive: true }, order: { displayOrder: "ASC", id: "ASC" } });
      const done = new Map((await this.checklistProgress.find({ where: { incidentId } })).map((p) => [p.itemId, p]));
      const rows: { id: number; name: string; description: string; required: boolean; done: boolean; checklist?: string }[] =
        items.map((i) => ({ id: i.id, name: i.name, description: i.description ?? "", required: i.isRequired, done: !!done.get(i.id)?.done }));

      const inc = await this.incidentsRepo.findOne({ where: { incidentId }, relations: { assignmentGroup: true, category: true } });
      if (inc) {
        const templates = await this.checklistTemplates.find({ where: { isActive: true }, order: { displayOrder: "ASC", id: "ASC" } });
        for (const t of templates) {
          if (t.groupId && t.groupId !== inc.assignmentGroup?.groupId) continue;
          if (t.statusName && t.statusName.toLowerCase() !== (inc.status ?? "").toLowerCase()) continue;
          if (!(await this.categoryMatches(t, inc.category?.categoryId ?? null))) continue;
          (t.tasks ?? []).forEach((task, idx) => {
            if (task.isActive === false || task.taskStatus === "Not Applicable") return;
            const id = RuleEngineService.templateTaskId(t.id, idx);
            rows.push({ id, name: task.taskName, description: task.remarks ?? "", required: task.taskStatus === "Mandatory", done: !!done.get(id)?.done, checklist: t.name });
          });
        }
      }
      const requiredTotal = rows.filter((r) => r.required).length;
      return { items: rows, doneCount: rows.filter((r) => r.done).length, total: rows.length, requiredOpen: rows.filter((r) => r.required && !r.done).length, requiredTotal };
    } catch (error) {
      console.error('Error in checklistFor for incident:', incidentId, error);
      throw error;
    }
  }

  /** A resolved incident carries a Resolution Code once any are configured (Configuration > Resolution Code). */
  async assertResolutionCode(provided?: string | null, existing?: string | null): Promise<void> {
    const active = await this.resolutionCodes.find({ where: { isActive: true } });
    if (!active.length) return;
    const code = (provided !== undefined ? provided : existing)?.trim();
    if (!code) throw new BadRequestException("Resolution Code is required to resolve this incident.");
    if (!active.some((c) => c.name.toLowerCase() === code.toLowerCase())) throw new BadRequestException(`"${code}" is not an active Resolution Code.`);
  }

  /** Resolving needs every required checklist item done and no work order still open. */
  async assertResolveGates(incidentId: string): Promise<void> {
    const cl = await this.checklistFor(incidentId);
    const openWos = await this.workOrders.count({ where: { incident: { incidentId }, isActive: true, status: In(["Open", "In Progress", "On Hold"]) } });
    const reasons: string[] = [];
    if (cl.requiredOpen > 0) reasons.push(`${cl.requiredOpen} required checklist item${cl.requiredOpen > 1 ? "s are" : " is"} still incomplete`);
    if (openWos > 0) reasons.push(`${openWos} work order${openWos > 1 ? "s are" : " is"} still open`);
    if (reasons.length) throw new BadRequestException(`Cannot resolve this incident: ${reasons.join(" and ")}.`);
  }

  // ── SLA pause (On Hold / Pending Customer) ───────────────────────────────
  isPausingStatus(status: string): boolean {
    return status === "On Hold" || this.isPendingStatus(status);
  }
  /** "Pending Customer", "Pending", "Pending Vendor"… — any status whose name starts with Pending. */
  isPendingStatus(status: string): boolean { return /^pending/i.test((status ?? "").trim()); }
  async statusPausesSla(status: string, holdReason?: string | null, pendingReason?: string | null): Promise<boolean> {
    if (status === "On Hold") return this.holdPausesSla(holdReason);
    if (this.isPendingStatus(status)) {
      if (!pendingReason) return true;
      const r = await this.pendingReasons.findOne({ where: { pendingReasonName: pendingReason } });
      return r ? r.slaImpact === "pause" : true;
    }
    return false;
  }


  /**
   * Target = start + minutes. If the workgroup has an active Service Window the minutes are counted
   * as business time in that window's time zone; otherwise plain wall-clock time.
   */
  async addSlaMinutes(start: Date, minutes: number, groupId?: number | null, windowId?: number | null): Promise<Date> {
    // A window chosen on the incident itself wins over the workgroup's window.
    if (windowId != null) {
      const window = await this.serviceWindows.findOne({ where: { slaServiceWindowId: windowId, isActive: true } });
      if (!window) throw new NotFoundException(`Active SLA service window ${windowId} not found`);
      return this.addMinutesInWindow(start, minutes, window);
    }
    if (groupId) {
      const gw = await this.groupWindows.findOne({ where: { groupId, isActive: true } });
      if (gw?.slaServiceWindowId) {
        const window = await this.serviceWindows.findOne({ where: { slaServiceWindowId: gw.slaServiceWindowId, isActive: true } });
        if (!window) throw new NotFoundException(`Active SLA service window ${gw.slaServiceWindowId} not found for workgroup ${groupId}`);
        return this.addMinutesInWindow(start, minutes, window);
      }
    }
    return new Date(start.getTime() + minutes * 60000);
  }

  private addMinutesInWindow(start: Date, minutes: number, window: SlaServiceWindow): Date {
    if (window.is24x7) return new Date(start.getTime() + minutes * 60000);
    const hasWorkingHours = window.serviceWindow?.some((day) => {
      const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
      return day.enabled
        && Number.isInteger(day.day) && day.day >= 1 && day.day <= 7
        && validTime(day.from) && validTime(day.to)
        && day.to > day.from;
    });
    if (!hasWorkingHours) {
      throw new BadRequestException(`SLA service window "${window.slaName}" has no enabled working hours`);
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: ianaZone(window.timeZone) });
    } catch {
      throw new BadRequestException(`SLA service window "${window.slaName}" has an invalid time zone`);
    }
    return addBusinessMinutes(start, minutes, window.serviceWindow, window.timeZone);
  }


  // ── Log Incident Page (which New Incident fields End Users see / must fill) ──
  /** End users only: hidden fields are ignored, visible+required fields must be present. Staff see everything. */
  async applyLogIncidentFields<T extends Record<string, any>>(dto: T, isStaff: boolean): Promise<T> {
    if (isStaff) return dto;
    const cfg = await this.logFields.find();
    const map: Record<string, string[]> = {
      category: ["categoryId"], classification: ["classificationId"], shortDescription: ["title"], description: ["description"],
      priority: ["priority"], impact: ["impact"], urgency: ["urgency"], assignmentGroup: ["assignmentGroupId"],
      assignedTo: ["assignedTo"], configurationItem: ["affectedAsset"], contactType: ["contactType"], location: ["locationId"],
    };
    const out: Record<string, any> = { ...dto };
    const missing: string[] = [];
    for (const f of cfg) {
      const keys = map[f.fieldKey]; if (!keys) continue;
      if (!f.visible) { keys.forEach((k) => { if (k !== "title") delete out[k]; }); continue; }
      if (f.required && keys.every((k) => out[k] === undefined || out[k] === null || String(out[k]).trim() === "")) missing.push(f.name);
    }
    if (missing.length) throw new BadRequestException(`Please fill in the required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`);
    return out as T;
  }


  /** Priority from the Impact × Urgency matrix, or null when no active row maps that pair. */
  async derivePriority(impact?: string | null, urgency?: string | null): Promise<string | null> {
    if (!impact || !urgency) return null;
    const row = await this.priorityMatrix.createQueryBuilder("m")
      .innerJoinAndSelect("m.priority", "p").innerJoin("m.impact", "i").innerJoin("m.urgency", "u")
      .where("m.isActive = true AND p.isActive = true AND lower(i.impactName) = lower(:impact) AND lower(u.urgencyName) = lower(:urgency)", { impact, urgency })
      .getOne();
    return row?.priority.priorityName ?? null;
  }

  // ── On Hold reason → SLA pause ───────────────────────────────────────────
  async holdPausesSla(reasonName?: string | null): Promise<boolean> {
    if (!reasonName) return true; // no reason chosen: conservative default is to pause
    const r = await this.onHold.findOne({ where: { name: reasonName } });
    return r ? r.slaImpact === "pause" : true;
  }
}
