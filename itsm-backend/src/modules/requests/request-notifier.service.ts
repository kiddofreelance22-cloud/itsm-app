import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MailService } from "../mail/mail.service";
import { ServiceRequest } from "./entities/request.entity";
import { RequestNotificationRule } from "../request-masters/entities/request-notification-rule.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { User } from "../users/entities/user.entity";

export interface NotifyContext {
  approvers?: User[];
  approvalStage?: string;
  approvalComments?: string;
  holdReason?: string;
}

/** Sends the e-mail rules configured under Configuration > E-mail Notification. Never throws. */
@Injectable()
export class RequestNotifier {
  private readonly logger = new Logger(RequestNotifier.name);

  constructor(
    private mail: MailService,
    @InjectRepository(RequestNotificationRule) private rulesRepo: Repository<RequestNotificationRule>,
    @InjectRepository(AssignmentGroup) private groupsRepo: Repository<AssignmentGroup>
  ) {}

  private fmtDate(d?: Date | null) {
    return d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—";
  }

  private params(request: ServiceRequest, ctx: NotifyContext, recipient: User): Record<string, string> {
    return {
      "request.number": request.requestNumber,
      "request.item": request.catalog?.catalogName ?? "",
      "request.category": request.catalog?.category?.categoryName ?? "",
      "request.priority": request.priority?.priorityName ?? "",
      "request.status": request.status,
      "request.requestedBy": request.requestedBy?.fullName ?? "",
      "request.assignedTo": request.assignedTo?.fullName ?? "Unassigned",
      "request.workgroup": request.assignmentGroup?.groupName ?? "",
      "request.dueDate": this.fmtDate(request.slaFulfilmentTarget),
      "request.holdReason": ctx.holdReason ?? request.pendingReason?.pendingReasonName ?? request.subStatus ?? "",
      "approval.stage": ctx.approvalStage ?? "",
      "approval.comments": ctx.approvalComments ?? "",
      "recipient.name": recipient.firstName || recipient.fullName || "",
    };
  }

  private fill(template: string, values: Record<string, string>): string {
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => values[key] ?? "");
  }

  /** Sends one configured e-mail template to the chosen recipient kinds (used by lifecycle "Send e-mail" steps). */
  async sendRule(ruleId: number, request: ServiceRequest, to: string[], ctx: NotifyContext = {}): Promise<void> {
    try {
      const rule = await this.rulesRepo.findOne({ where: { ruleId } });
      if (!rule || rule.isActive === false) return;
      const recipients = new Map<number, User>();
      const add = (u?: User | null) => { if (u?.email && u.isActive !== false) recipients.set(u.userId, u); };
      for (const kind of to) {
        if (kind === "requester" || kind === "requestedFor") add(request.requestedBy);
        if (kind === "approver") (ctx.approvers ?? []).forEach(add);
        if (kind === "assignedAgent") add(request.assignedTo);
        if (kind === "workgroup" && request.assignmentGroup) {
          const g = await this.groupsRepo.findOne({ where: { groupId: request.assignmentGroup.groupId }, relations: { members: true } });
          (g?.members ?? []).forEach(add);
        }
      }
      for (const user of recipients.values()) {
        const values = this.params(request, ctx, user);
        await this.mail.queue({ to: user.email, subject: this.fill(rule.subject, values), html: this.fill(rule.body, values) });
      }
    } catch (err) {
      this.logger.warn(`E-mail step (rule ${ruleId}) for request ${request.requestId} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** A plain notice to specific people (used by the "If approved: notify" outcome). */
  async sendNotice(users: User[], subject: string, html: string): Promise<void> {
    for (const u of users) {
      if (!u.email || u.isActive === false) continue;
      try { await this.mail.queue({ to: u.email, subject, html }); } catch (err) { this.logger.warn(`Notice to ${u.email} failed: ${err instanceof Error ? err.message : String(err)}`); }
    }
  }

  async notify(eventKey: string, request: ServiceRequest, ctx: NotifyContext = {}): Promise<void> {
    try {
      const rules = await this.rulesRepo.find({ where: { eventKey, isActive: true }, order: { displayOrder: "ASC" } });
      for (const rule of rules) {
        const recipients = new Map<number, User>();
        const add = (u?: User | null) => { if (u?.email && u.isActive !== false) recipients.set(u.userId, u); };
        for (const kind of rule.recipients ?? []) {
          if (kind === "requester" || kind === "requestedFor") add(request.requestedBy);
          if (kind === "approver") (ctx.approvers ?? []).forEach(add);
          if (kind === "assignedAgent") add(request.assignedTo);
          if (kind === "workgroup" && request.assignmentGroup) {
            const g = await this.groupsRepo.findOne({ where: { groupId: request.assignmentGroup.groupId }, relations: { members: true } });
            (g?.members ?? []).forEach(add);
          }
        }
        for (const user of recipients.values()) {
          const values = this.params(request, ctx, user);
          await this.mail.queue({ to: user.email, subject: this.fill(rule.subject, values), html: this.fill(rule.body, values) });
        }
      }
    } catch (err) {
      this.logger.warn(`Notification "${eventKey}" for request ${request.requestId} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
