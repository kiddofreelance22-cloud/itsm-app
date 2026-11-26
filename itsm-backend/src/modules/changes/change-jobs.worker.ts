import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { In, Repository } from "typeorm";
import { Change } from "./entities/change.entity";
import { ChangeApproval } from "./entities/change-approval.entity";
import { ChangeConfigService } from "./change-config.service";
import { ChangeNotifier } from "./change-notifier.service";
import { User } from "../users/entities/user.entity";
import { ChangesService } from "./changes.service";

const HOUR = 3600000;

/** Time-based notifications: approval reminders and escalations, 24-hour notices, overruns, template reviews. Each is sent once. */
@Injectable()
export class ChangeJobsWorker {
  private readonly logger = new Logger(ChangeJobsWorker.name);
  private running = false;

  constructor(
    @InjectRepository(Change) private changes: Repository<Change>,
    @InjectRepository(ChangeApproval) private approvals: Repository<ChangeApproval>,
    @InjectRepository(User) private users: Repository<User>,
    private cfg: ChangeConfigService,
    private notifier: ChangeNotifier,
    private changesService: ChangesService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try { await this.resumeLifecycleActions(); await this.approvalChasers(); await this.upcomingAndOverruns(); await this.templateReviews(); }
    catch (e) { this.logger.error(`Change jobs failed: ${e instanceof Error ? e.message : e}`); }
    finally { this.running = false; }
  }

  private async resumeLifecycleActions() {
    const now = new Date();
    const waiting = await this.changes.createQueryBuilder("c")
      .where("c.state IN ('Assess', 'Authorize')")
      .andWhere("c.lifecycleStepIndex IS NOT NULL")
      .andWhere("(c.lifecycleWaitUntil IS NULL OR c.lifecycleWaitUntil <= :now)", { now })
      .orderBy("c.changeId", "ASC")
      .limit(100)
      .getMany();
    for (const change of waiting) {
      try { await this.changesService.resumeDueLifecycle(change.changeId); }
      catch (e) { this.logger.error(`Lifecycle for ${change.changeCode} failed: ${e instanceof Error ? e.message : e}`); }
    }
  }

  /** Reminder after `remindHours`, escalation to the change managers after `escalateHours`, counted from when the stage was requested. */
  private async approvalChasers() {
    const { settings, groups } = (await this.cfg.effective()).approval;
    if (!settings.remindHours && !settings.escalateHours) return;
    const open = await this.approvals.createQueryBuilder("a").innerJoinAndSelect("a.change", "c")
      .where("a.status = 'Pending'").andWhere("c.state = 'Authorize'")
      .andWhere(`a.stage = (SELECT MIN(p.stage) FROM change_approvals p WHERE p.change_id = a.change_id AND p.status = 'Pending')`).getMany();
    const byChange = new Map<number, ChangeApproval>();
    for (const a of open) if (!byChange.has(a.change.changeId)) byChange.set(a.change.changeId, a);
    for (const a of byChange.values()) {
      // The stage is "requested" when the previous stage was decided, or when the change was submitted.
      const prior = await this.approvals.find({ where: { change: { changeId: a.change.changeId } } });
      const since = Math.max(+a.createdAt, ...prior.filter((p) => p.stage < a.stage && p.decidedAt).map((p) => +p.decidedAt!));
      const waited = (Date.now() - since) / HOUR;
      const stageKey = `${a.change.changeId}:${a.stage}:${since}`;
      if (settings.remindHours && waited >= settings.remindHours) await this.notifier.notify("e3", a.change.changeId, { dedupe: `e3:${stageKey}` });
      if (settings.escalateHours && waited >= settings.escalateHours) {
        const mgr = groups.find((g) => g.name === "Change Management")?.members.map((m) => m.userId) ?? [];
        const to = mgr.length ? (await this.users.find({ where: { userId: In(mgr), isActive: true } })).map((u) => u.email).filter(Boolean) : [];
        if (to.length) await this.notifier.notify("e3", a.change.changeId, { dedupe: `esc:${stageKey}`, recipients: to, subjectPrefix: "ESCALATION — " });
      }
    }
  }

  private async upcomingAndOverruns() {
    const now = new Date();
    const soon = await this.changes.createQueryBuilder("c").where("c.state = 'Scheduled'").andWhere("c.plannedStart > :n AND c.plannedStart <= :t", { n: now, t: new Date(+now + 24 * HOUR) }).getMany();
    for (const c of soon) await this.notifier.notify("e10", c.changeId, { dedupe: `e10:${c.changeId}:${+c.plannedStart!}` });
    const late = await this.changes.createQueryBuilder("c").where("c.state = 'Implement'").andWhere("c.plannedEnd < :n", { n: now }).getMany();
    for (const c of late) await this.notifier.notify("e12", c.changeId, { dedupe: `e12:${c.changeId}:${+c.plannedEnd!}` });
  }

  private async templateReviews() {
    const s = await this.cfg.effective();
    const horizon = new Date(Date.now() + 30 * 24 * HOUR);
    const anchor = await this.changes.findOne({ where: {}, order: { changeId: "DESC" } });   // notifications are rendered against a change; skip when there are none yet
    if (!anchor) return;
    for (const t of s.templates.filter((x) => x.status === "Active" && x.nextReview && new Date(x.nextReview) <= horizon)) {
      if (!(await this.notifier.claim(`e18:${t.id}:${t.nextReview}`))) continue;
      const ev = s.notifications.find((e) => e.id === "e18");
      if (!ev?.on) continue;
      const mgr = s.approval.groups.find((g) => g.name === "Change Management")?.members.map((m) => m.userId) ?? [];
      const to = mgr.length ? (await this.users.find({ where: { userId: In(mgr), isActive: true } })).map((u) => u.email).filter(Boolean) : [];
      if (to.length) await this.notifier.notify("e18", anchor.changeId, { recipients: to, vars: { short_description: t.name } });
    }
  }
}
