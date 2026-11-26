import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { MailService } from "../mail/mail.service";
import { User } from "../users/entities/user.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { Change } from "./entities/change.entity";
import { ChangeNotificationLog } from "./entities/change-notification-log.entity";
import { ChangeConfigService } from "./change-config.service";
import { ChangeSettings, categoryPath } from "./change-config";

export interface NotifyContext {
  approver?: string; comments?: string; subjectPrefix?: string;
  /** Extra or overriding merge fields, e.g. a template name. */
  vars?: Record<string, string>;
  /** Overrides the event's configured recipients (used for escalations). */
  recipients?: string[];
  /** When set, the notification is sent at most once for this key (reminders, 24-hour notices, overruns). */
  dedupe?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const p2 = (n: number) => String(n).padStart(2, "0");
export const fmtWhen = (d?: Date | null) => (d ? `${p2(d.getDate())} ${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}` : "not set");

/** Sends the e-mails configured under Configuration → E-mail Notification. Never throws: a mail problem must not break a change. */
@Injectable()
export class ChangeNotifier {
  private readonly log = new Logger(ChangeNotifier.name);

  constructor(
    private cfg: ChangeConfigService,
    private mail: MailService,
    @InjectRepository(Change) private changes: Repository<Change>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(AssignmentGroup) private assignmentGroups: Repository<AssignmentGroup>,
    @InjectRepository(ChangeNotificationLog) private sent: Repository<ChangeNotificationLog>,
  ) {}

  /** True if this is the first time the key is claimed. */
  async claim(key: string): Promise<boolean> {
    try { await this.sent.insert({ key }); return true; } catch { return false; }
  }

  private groupEmails(settings: ChangeSettings, name: string): Promise<User[]> {
    const ids = settings.approval.groups.find((g) => g.name === name)?.members.map((m) => m.userId) ?? [];
    return ids.length ? this.users.find({ where: { userId: In(ids), isActive: true } }) : Promise.resolve([]);
  }

  private async resolve(kind: string, c: Change, settings: ChangeSettings): Promise<string[]> {
    const emails = (us: (User | undefined | null)[]) => us.map((u) => u?.email).filter((e): e is string => !!e);
    switch (kind) {
      case "Requester": return emails([c.requestedBy]);
      case "Change owner": return emails([c.assignedTo]);
      case "Change manager": return emails(await this.groupEmails(settings, "Change Management"));
      case "CAB members": return emails(await this.groupEmails(settings, "CAB"));
      case "ECAB members": return emails(await this.groupEmails(settings, "ECAB"));
      case "Current approvers": {
        const open = (c.approvals ?? []).filter((a) => a.status === "Pending");
        const stage = open.length ? Math.min(...open.map((a) => a.stage)) : 0;
        const rows = open.filter((a) => a.stage === stage);
        const direct = emails(rows.map((a) => a.approver));
        if (direct.length) return direct;
        return rows.length ? emails(await this.groupEmails(settings, rows[0].approvalGroup)) : [];
      }
      case "Assignment group": {
        if (!c.assignmentGroup) return [];
        const g = await this.assignmentGroups.findOne({ where: { groupName: c.assignmentGroup }, relations: { members: true } });
        return emails(g?.members ?? []);
      }
      default: return [];
    }
  }

  async notify(eventId: string, changeId: number, ctx: NotifyContext = {}): Promise<void> {
    try {
      const settings = await this.cfg.effective();
      const ev = settings.notifications.find((e) => e.id === eventId);
      if (!ev?.on) return;
      if (ctx.dedupe && !(await this.claim(ctx.dedupe))) return;
      const c = await this.changes.findOne({ where: { changeId }, relations: { requestedBy: true, assignedTo: true, approvals: { approver: true } } });
      if (!c) return;
      const to = ctx.recipients ?? Array.from(new Set((await Promise.all(ev.recipients.map((r) => this.resolve(r, c, settings)))).flat()));
      if (!to.length) return;
      const link = `${(process.env.FRONTEND_URL ?? "").replace(/\/$/, "")}/changes/${c.changeId}`;
      const name = (u?: User | null) => (u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username : "");
      const vars: Record<string, string> = {
        number: c.changeCode, short_description: c.shortDescription, description: c.description ?? "", type: c.changeType, state: c.state, risk: c.riskLevel ?? "not assessed", priority: c.priority ?? "",
        category: categoryPath(settings, c.category) || c.category || "", service: c.businessService ?? "not set", assignment_group: c.assignmentGroup ?? "", requester: name(c.requestedBy), owner: name(c.assignedTo),
        planned_start: fmtWhen(c.plannedStart), planned_end: fmtWhen(c.plannedEnd), link, approver: ctx.approver ?? "an approver", comments: ctx.comments ?? "", ...ctx.vars,
      };
      // Tokens may be written {{change.number}}, {{number}} or ${number}. In an HTML body the values are escaped, so a change title can never inject markup.
      const fill = (t: string, html: boolean) => t
        .replace(/\{\{\s*(?:change\.)?(\w+)\s*\}\}/g, (_m, k) => (html ? esc(vars[k] ?? "") : vars[k] ?? ""))
        .replace(/\$\{(\w+)\}/g, (_m, k) => (html ? esc(vars[k] ?? "") : vars[k] ?? ""));
      await this.mail.queue({
        to, subject: `${ctx.subjectPrefix ?? ""}${fill(ev.subject, false)}`,
        html: ev.format === "html" ? fill(ev.body, true) : `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${esc(fill(ev.body, false)).replace(/\n/g, "<br/>")}</div>`,
      });
    } catch (e) {
      this.log.error(`Notification ${eventId} for change ${changeId} failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  async sendLifecycleEmail(changeId: number, recipients: string[], subject: string, body: string): Promise<void> {
    const settings = await this.cfg.effective();
    const c = await this.changes.findOne({ where: { changeId }, relations: { requestedBy: true, assignedTo: true } });
    if (!c) throw new Error(`Change ${changeId} not found for lifecycle e-mail.`);
    const name = (u?: User | null) => (u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username : "");
    const vars: Record<string, string> = {
      number: c.changeCode, short_description: c.shortDescription, description: c.description ?? "", type: c.changeType,
      state: c.state, risk: c.riskLevel ?? "not assessed", priority: c.priority ?? "", category: categoryPath(settings, c.category) || c.category || "",
      service: c.businessService ?? "not set", assignment_group: c.assignmentGroup ?? "", requester: name(c.requestedBy), owner: name(c.assignedTo),
      planned_start: fmtWhen(c.plannedStart), planned_end: fmtWhen(c.plannedEnd),
      link: `${(process.env.FRONTEND_URL ?? "").replace(/\/$/, "")}/changes/${c.changeId}`,
    };
    const fill = (value: string) => value
      .replace(/\{\{\s*(?:change\.)?(\w+)\s*\}\}/g, (_m, key) => vars[key] ?? "")
      .replace(/\$\{(\w+)\}/g, (_m, key) => vars[key] ?? "");
    await this.mail.queue({
      to: [...new Set(recipients)], subject: fill(subject),
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${esc(fill(body)).replace(/\n/g, "<br/>")}</div>`,
    });
  }
}
