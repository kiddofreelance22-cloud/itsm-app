import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MailService } from "../mail/mail.service";
import { Incident } from "../incidents/entities/incident.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { User } from "../users/entities/user.entity";
import { NotificationRule } from "./entities/notification-rule.entity";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/**
 * Sends the e-mails configured in Configuration > E-mail Notification.
 * Strictly best-effort: a mail failure must never fail the incident action.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationRule) private rules: Repository<NotificationRule>,
    @InjectRepository(AssignmentGroup) private groups: Repository<AssignmentGroup>,
    @InjectRepository(User) private users: Repository<User>,
    private mail: MailService,
  ) {}

  /** `incident` must have createdBy / assignedTo / assignmentGroup loaded (IncidentsService.findOne does). */
  async dispatch(event: string, incident: Incident): Promise<void> {
    try {
      const rules = await this.rules.find({ where: { triggerEvent: event, isActive: true }, order: { displayOrder: "ASC" } });
      for (const rule of rules) {
        const to = await this.resolveRecipients(rule.recipients, incident);
        if (!to.length) continue;
        const isHtml = rule.bodyFormat === "html";
        const subject = this.fill(rule.subject, incident);
        // HTML rules are sent as designed (parameter values are escaped); plain-text rules keep their line breaks.
        const html = isHtml ? this.fill(rule.body ?? "", incident, true) : esc(this.fill(rule.body ?? "", incident)).replace(/\n/g, "<br>");
        const text = isHtml ? html.replace(/<(br|\/p|\/div|\/tr|\/h\d)\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim() : this.fill(rule.body ?? "", incident);
        await this.mail.sendMail({ to, subject, html, text });
      }
    } catch (err) {
      this.logger.warn(`Notification "${event}" for ${incident?.incidentId} failed: ${(err as Error).message}`);
    }
  }

  /** Replaces {{incident.*}} parameters; `escapeValues` HTML-escapes them for HTML bodies. */
  private fill(template: string, i: Incident, escapeValues = false): string {
    const base = (process.env.FRONTEND_URL ?? "").replace(/\/$/, "");
    const map: Record<string, string> = {
      "incident.id": i.incidentCode ?? i.incidentId,
      "incident.shortDescription": i.title ?? "",
      "incident.description": i.description ?? "",
      "incident.priority": i.priority ?? "",
      "incident.status": i.status ?? "",
      "incident.category": i.category?.categoryName ?? "",
      "incident.assignedTo": i.assignedTo?.fullName ?? "Unassigned",
      "incident.assignmentGroup": i.assignmentGroup?.groupName ?? "",
      "incident.reporter": i.createdBy?.fullName ?? "",
      "incident.reporterEmail": i.createdBy?.email ?? "",
      "incident.createdAt": i.createdAt ? new Date(i.createdAt).toUTCString() : "",
      "incident.resolutionNotes": i.resolutionNotes ?? "",
      "incident.resolutionCode": i.resolutionCode ?? "",
      "incident.link": `${base}/incidents/${encodeURIComponent(i.incidentId)}`,
    };
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => (k in map ? (escapeValues ? esc(map[k]) : map[k]) : m));
  }

  private async resolveRecipients(keys: string[], i: Incident): Promise<string[]> {
    const out = new Set<string>();
    for (const key of keys) {
      if (key === "reporter" && i.createdBy?.email) out.add(i.createdBy.email);
      if (key === "assignedAgent" && i.assignedTo?.email) out.add(i.assignedTo.email);
      if (key === "workgroup" && i.assignmentGroup?.groupId) {
        const g = await this.groups.findOne({ where: { groupId: i.assignmentGroup.groupId }, relations: { members: true } });
        g?.members?.forEach((m: any) => m?.email && out.add(m.email));
      }
      if (key === "approver") {
        const rows: Array<{ email: string }> = await this.users.query(
          `SELECT DISTINCT u.email FROM users u
             JOIN user_roles ur ON ur.user_id = u.user_id
             JOIN roles r ON r.role_id = ur.role_id
            WHERE u.is_active = true AND r.role_name IN ('Admin','Administrator','IT Manager')`,
        );
        rows.forEach((r) => r.email && out.add(r.email));
      }
      // "watchers": the platform has no watcher list yet, so nobody is added.
    }
    return [...out];
  }
}
