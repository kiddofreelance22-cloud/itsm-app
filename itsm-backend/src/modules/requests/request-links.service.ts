import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, MoreThanOrEqual, Repository, type FindOptionsWhere } from "typeorm";
import { RequestLink, type LinkTargetType } from "./entities/request-link.entity";
import { RequestWorkNote } from "./entities/request-work-note.entity";
import { ServiceRequest } from "./entities/request.entity";
import { Incident } from "../incidents/entities/incident.entity";
import { Change } from "../changes/entities/change.entity";
import { Problem } from "../problems/entities/problem.entity";
import { WorkOrder } from "../itsm-config/entities/work-order.entity";
import { IncidentsService } from "../incidents/incidents.service";
import { ChangesService } from "../changes/changes.service";
import { ProblemsService } from "../problems/problems.service";
import { RequestsService, type Actor } from "./requests.service";
import type { AttachLinkDto, CreateRelatedDto, LinkCandidatesQueryDto } from "./dto/request-links.dto";

export interface LinkedTicket { id?: string | number; type: LinkTargetType; number: string; title: string; status: string; group: string | null; raisedBy: string | null; createdAt: Date | null }
const INVERSE: Record<string, string> = { "Parent of": "Child of", "Child of": "Parent of", "Caused by": "Cause of", "Cause of": "Caused by", "Duplicate of": "Duplicated by", "Duplicated by": "Duplicate of" };
const CLOSED: Record<LinkTargetType, string[]> = {
  request: ["Fulfilled", "Closed", "Rejected", "Cancelled"], incident: ["Resolved", "Closed"], change: ["Completed", "Cancelled"],
  problem: ["Resolved", "Closed"], work_order: ["Completed", "Cancelled"],
};
const TYPE_LABEL: Record<LinkTargetType, string> = { request: "Service request", incident: "Incident", change: "Change", problem: "Problem", work_order: "Work order" };

/** Tickets linked from a service request, related records raised from it, and internal work notes. Agents and admins only. */
@Injectable()
export class RequestLinksService {
  constructor(
    @InjectRepository(RequestLink) private links: Repository<RequestLink>,
    @InjectRepository(RequestWorkNote) private notes: Repository<RequestWorkNote>,
    @InjectRepository(ServiceRequest) private requests: Repository<ServiceRequest>,
    @InjectRepository(Incident) private incidents: Repository<Incident>,
    @InjectRepository(Change) private changes: Repository<Change>,
    @InjectRepository(Problem) private problems: Repository<Problem>,
    @InjectRepository(WorkOrder) private workOrders: Repository<WorkOrder>,
    private incidentsSvc: IncidentsService,
    private changesSvc: ChangesService,
    private problemsSvc: ProblemsService,
    private requestsSvc: RequestsService,
  ) {
    // A lifecycle "Create related record" step raises its ticket through here.
    requestsSvc.setRecordRaiser(async (request, a) => {
      const f = (t?: string) => (t ?? "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => ({ "request.number": request.requestNumber, "request.item": request.catalog?.catalogName ?? "", "request.requestedBy": request.requestedBy?.fullName ?? "" } as Record<string, string>)[k] ?? "");
      const made = await this.raise(request, request.requestedBy.userId, ["Admin"] /* a lifecycle step is a system action, so the end-user "required fields" rules do not apply */, { type: a.recordType, shortDescription: f(a.title), description: f(a.description) || undefined, priority: a.priority, priorityId: a.priorityId, catalogId: a.catalogId } as CreateRelatedDto, true);
      return made.number;
    });
  }

  private async load(requestId: number, actor: Actor): Promise<ServiceRequest> {
    this.requestsSvc.assertAgentAccess(actor);
    const r = await this.requests.findOne({ where: { requestId }, relations: { requestedBy: true, assignmentGroup: true, catalog: true } });
    if (!r) throw new NotFoundException(`Request ${requestId} not found`);
    return r;
  }

  /** Finds a ticket by its number (case-insensitive). */
  async resolve(type: LinkTargetType, number: string): Promise<LinkedTicket | null> {
    const n = number.trim();
    if (type === "incident") {
      const i = await this.incidents.findOne({ where: { incidentCode: ILike(n) }, relations: { assignmentGroup: true, createdBy: true } });
      return i ? { id: i.incidentId, type, number: i.incidentCode, title: i.title, status: i.status, group: i.assignmentGroup?.groupName ?? null, raisedBy: i.createdBy?.fullName ?? null, createdAt: i.createdAt } : null;
    }
    if (type === "change") {
      const c = await this.changes.findOne({ where: { changeCode: ILike(n) } });
      return c ? { type, number: c.changeCode, title: c.shortDescription, status: c.status, group: null, raisedBy: null, createdAt: c.createdAt } : null;
    }
    if (type === "problem") {
      const p = await this.problems.findOne({ where: { problemCode: ILike(n) } });
      return p ? { type, number: p.problemCode, title: p.shortDescription, status: p.status, group: null, raisedBy: null, createdAt: p.createdAt } : null;
    }
    if (type === "work_order") {
      const w = await this.workOrders.findOne({ where: { woNumber: ILike(n) }, relations: { group: true, createdBy: true } });
      return w ? { id: w.workOrderId, type, number: w.woNumber, title: w.title, status: w.status, group: w.group?.groupName ?? null, raisedBy: w.createdBy?.fullName ?? null, createdAt: w.createdAt } : null;
    }
    const r = await this.requests.findOne({ where: { requestNumber: ILike(n) }, relations: { catalog: true, assignmentGroup: true, requestedBy: true } });
    return r ? { id: r.requestId, type, number: r.requestNumber, title: r.catalog?.catalogName ?? "Service request", status: r.status, group: r.assignmentGroup?.groupName ?? null, raisedBy: r.requestedBy?.fullName ?? null, createdAt: r.createdAt } : null;
  }

  private async view(l: RequestLink, direction: "out" | "in", alsoLinked: string[] = []) {
    const live = await this.resolve(l.targetType, l.targetRef);
    return {
      linkId: l.linkId, type: l.targetType, number: live?.number ?? l.targetRef, title: live?.title ?? l.title ?? "", status: live?.status ?? "Unavailable",
      relation: l.relation, details: l.details ?? null, group: live?.group ?? null, direction, createdAt: l.createdAt, alsoLinked, targetId: live?.id ?? null,
    };
  }

  async list(requestId: number, actor: Actor) {
    const r = await this.load(requestId, actor);
    const out = await this.links.find({ where: { request: { requestId } }, order: { linkId: "ASC" } });
    const rows: Array<Record<string, unknown>> = [];
    for (const l of out) {
      const others = await this.links.find({ where: { targetType: l.targetType, targetRef: l.targetRef }, relations: { request: true } });
      const also = others.filter((o) => o.request.requestId !== requestId).map((o) => o.request.requestNumber);
      rows.push(await this.view(l, "out", also));
    }
    const incoming = await this.links.find({ where: { targetType: "request", targetRef: r.requestNumber }, relations: { request: { catalog: true, assignmentGroup: true } }, order: { linkId: "ASC" } });
    for (const l of incoming) {
      rows.push({
        linkId: l.linkId, type: "request" as LinkTargetType, number: l.request.requestNumber, title: l.request.catalog?.catalogName ?? "Service request", status: l.request.status,
        relation: INVERSE[l.relation] ?? l.relation, details: l.details ?? null, group: l.request.assignmentGroup?.groupName ?? null, direction: "in" as const, createdAt: l.createdAt, alsoLinked: [], targetId: l.request.requestId,
      });
    }
    return rows;
  }

  async attach(requestId: number, actor: Actor, dto: AttachLinkDto) {
    const r = await this.load(requestId, actor);
    const found = await this.resolve(dto.type, dto.targetNumber);
    if (!found) throw new NotFoundException(`No ${TYPE_LABEL[dto.type].toLowerCase()} numbered ${dto.targetNumber.trim()} was found`);
    if (found.type === "request" && found.number === r.requestNumber) throw new BadRequestException("A request cannot be linked to itself");
    if (await this.links.findOne({ where: { request: { requestId }, targetType: found.type, targetRef: found.number } })) throw new ConflictException(`${found.number} is already linked to this request`);
    const saved = await this.links.save(this.links.create({ request: r, targetType: found.type, targetRef: found.number, relation: dto.relation ?? "Related to", title: found.title, createdBy: { userId: actor.userId } as never }));
    await this.requestsSvc.logUpdate(requestId, actor.userId, `Linked ${TYPE_LABEL[found.type].toLowerCase()} ${found.number} (${saved.relation})`);
    return this.view(saved, "out");
  }

  async updateRelation(requestId: number, linkId: number, actor: Actor, relation: string) {
    await this.load(requestId, actor);
    const l = await this.links.findOne({ where: { linkId, request: { requestId } } });
    if (!l) throw new NotFoundException("That link is not on this request");
    const before = l.relation; l.relation = relation;
    await this.links.save(l);
    await this.requestsSvc.logUpdate(requestId, actor.userId, `${l.targetRef}: relationship changed from ${before} to ${relation}`);
    return this.view(l, "out");
  }

  async remove(requestId: number, linkId: number, actor: Actor): Promise<void> {
    await this.load(requestId, actor);
    const r = await this.requests.findOneOrFail({ where: { requestId } });
    let l = await this.links.findOne({ where: { linkId, request: { requestId } } });
    let unlinkedRef = "";
    if (l) {
      unlinkedRef = l.targetRef;
    } else {
      l = await this.links.findOne({ where: { linkId, targetType: "request", targetRef: r.requestNumber }, relations: { request: true } });
      if (l) {
        unlinkedRef = l.request?.requestNumber ?? l.targetRef;
      }
    }
    if (!l) throw new NotFoundException("That link is not on this request");
    await this.links.remove(l);
    await this.requestsSvc.logUpdate(requestId, actor.userId, `Unlinked ${unlinkedRef}`);
  }

  /** Raises a new record from the request and links it. */
  async create(requestId: number, actor: Actor, dto: CreateRelatedDto) {
    const r = await this.load(requestId, actor);
    return this.raise(r, actor.userId, actor.roles, dto, false, actor);
  }

  /** Does the raising. `viaLifecycle` is true when a lifecycle step, not a person, is raising it. */
  private async raise(r: ServiceRequest, actorUserId: number, actorRoles: string[], dto: CreateRelatedDto, viaLifecycle: boolean, actor?: Actor) {
    const requestId = r.requestId;
    const title = dto.shortDescription.trim(); const desc = dto.description?.trim() || undefined;
    let number = ""; let details: string | null = null;
    if (dto.type === "incident") {
      const inc = await this.incidentsSvc.create(actorUserId, { title, description: desc, priority: dto.priority ? dto.priority.replace(/^P\d\s*-\s*/, "") : undefined, requestId, callerId: r.requestedBy?.userId, assignmentGroupId: r.assignmentGroup?.groupId } as never, actorRoles);
      number = inc.incidentCode; details = dto.priority ?? null;
    } else if (dto.type === "change") {
      const c = await this.changesSvc.create({ shortDescription: title, description: desc } as never);
      number = c.changeCode; details = [dto.changeType ? `${dto.changeType} change` : null, dto.plannedDate ? `planned ${dto.plannedDate}` : null].filter(Boolean).join(" - ") || null;
    } else if (dto.type === "problem") {
      const p = await this.problemsSvc.create({ shortDescription: title, description: desc } as never);
      number = p.problemCode; details = dto.priority ?? null;
    } else if (dto.type === "work_order") {
      const notes = [desc, dto.location ? `Location: ${dto.location}` : null, dto.plannedDate ? `Scheduled: ${dto.plannedDate}` : null, `Raised from ${r.requestNumber}`].filter(Boolean).join("\n");
      const w = await this.workOrders.save(this.workOrders.create({ title, notes, priority: dto.priority ?? "P3 - Medium", status: "Open", group: r.assignmentGroup ?? null, createdBy: { userId: actorUserId } as never }));
      number = (await this.workOrders.findOneOrFail({ where: { workOrderId: w.workOrderId } })).woNumber; // number is a database default
      details = [dto.location, dto.plannedDate ? `scheduled ${dto.plannedDate}` : null].filter(Boolean).join(" - ") || null;
    } else {
      if (!dto.catalogId) throw new BadRequestException("Choose the catalog item for the new request");
      const made = await this.requestsSvc.create(r.requestedBy.userId, { catalogId: dto.catalogId, variableValues: [], notes: [title, desc].filter(Boolean).join("\n\n"), priorityId: dto.priorityId } as never, actorUserId, viaLifecycle);
      number = made.requestNumber; details = null;
    }
    const saved = await this.links.save(this.links.create({ request: r, targetType: dto.type, targetRef: number, relation: dto.relation ?? (dto.type === "request" ? "Parent of" : "Related to"), title, details, createdBy: { userId: actorUserId } as never }));
    await this.requestsSvc.logUpdate(requestId, viaLifecycle ? null : actorUserId, `Raised ${TYPE_LABEL[dto.type].toLowerCase()} ${number} from this request`);
    if (dto.convert && dto.type === "incident" && actor) await this.requestsSvc.cancelAsConverted(requestId, actor, number);
    return this.view(saved, "out");
  }

  /** Tickets that could be linked, filtered the way the "Add existing ticket" picker asks. */
  async candidates(requestId: number, actor: Actor, q: LinkCandidatesQueryDto): Promise<{ items: LinkedTicket[]; note?: string }> {
    const r = await this.load(requestId, actor);
    const type = q.type; const text = q.q?.trim(); const state = q.state ?? "any";
    const since = q.raised && q.raised !== "any" ? new Date(Date.now() - Number(q.raised) * 86400000) : null;
    const closed = CLOSED[type]; const notes: string[] = [];
    const statusIn = (all: string[]) => (state === "closed" ? closed : all.filter((s) => !closed.includes(s)));
    const already = new Set((await this.links.find({ where: { request: { requestId } } })).map((l) => `${l.targetType}:${l.targetRef.toUpperCase()}`));
    const wantMine = q.raisedBy === "me";
    const wantRequester = q.match === "requester"; const wantGroup = q.match === "group";
    const canWho = type === "incident" || type === "request" || type === "work_order";
    if ((wantMine || wantRequester) && !canWho) notes.push(`${TYPE_LABEL[type]}s do not record who raised them, so that filter was not applied.`);
    if (wantGroup && (type === "change" || type === "problem")) notes.push(`${TYPE_LABEL[type]}s have no assignment group, so that filter was not applied.`);
    const order = q.sort === "oldest" ? "ASC" : "DESC";
    const keep = (t: LinkedTicket) => !already.has(`${t.type}:${t.number.toUpperCase()}`) && !(t.type === "request" && t.number === r.requestNumber);
    let items: LinkedTicket[] = [];
    const whoId = wantMine ? actor.userId : wantRequester ? r.requestedBy?.userId : undefined;
    const base = <T extends object>(extra: FindOptionsWhere<T>[]): FindOptionsWhere<T>[] => extra;

    if (type === "incident") {
      const rows = await this.incidents.find({ where: base<Incident>(this.mix<Incident>({ ...(since ? { createdAt: MoreThanOrEqual(since) } : {}), ...(whoId && canWho ? { createdBy: { userId: whoId } } : {}), ...(wantGroup && r.assignmentGroup ? { assignmentGroup: { groupId: r.assignmentGroup.groupId } } : {}) } as FindOptionsWhere<Incident>, text ? [{ incidentCode: ILike(`%${text}%`) }, { title: ILike(`%${text}%`) }] as FindOptionsWhere<Incident>[] : [{}])), relations: { assignmentGroup: true, createdBy: true }, order: { createdAt: order }, take: 200 });
      items = rows.filter((i) => state === "any" || statusIn(["Open", "Assigned", "In Progress", "On Hold", "Resolved", "Closed"]).includes(i.status)).map((i) => ({ id: i.incidentId, type, number: i.incidentCode, title: i.title, status: i.status, group: i.assignmentGroup?.groupName ?? null, raisedBy: i.createdBy?.fullName ?? null, createdAt: i.createdAt }));
    } else if (type === "change") {
      const rows = await this.changes.find({ where: this.mix<Change>({ ...(since ? { createdAt: MoreThanOrEqual(since) } : {}) } as FindOptionsWhere<Change>, text ? [{ changeCode: ILike(`%${text}%`) }, { shortDescription: ILike(`%${text}%`) }] as FindOptionsWhere<Change>[] : [{}]), order: { createdAt: order }, take: 200 });
      items = rows.filter((c) => state === "any" || statusIn(["Open", "In Progress", "Completed", "Cancelled"]).includes(c.status)).map((c) => ({ type, number: c.changeCode, title: c.shortDescription, status: c.status, group: null, raisedBy: null, createdAt: c.createdAt }));
    } else if (type === "problem") {
      const rows = await this.problems.find({ where: this.mix<Problem>({ ...(since ? { createdAt: MoreThanOrEqual(since) } : {}) } as FindOptionsWhere<Problem>, text ? [{ problemCode: ILike(`%${text}%`) }, { shortDescription: ILike(`%${text}%`) }] as FindOptionsWhere<Problem>[] : [{}]), order: { createdAt: order }, take: 200 });
      items = rows.filter((p) => state === "any" || statusIn(["Open", "In Progress", "Resolved", "Closed"]).includes(p.status)).map((p) => ({ type, number: p.problemCode, title: p.shortDescription, status: p.status, group: null, raisedBy: null, createdAt: p.createdAt }));
    } else if (type === "work_order") {
      const rows = await this.workOrders.find({ where: this.mix<WorkOrder>({ ...(since ? { createdAt: MoreThanOrEqual(since) } : {}), ...(whoId ? { createdBy: { userId: whoId } } : {}), ...(wantGroup && r.assignmentGroup ? { group: { groupId: r.assignmentGroup.groupId } } : {}) } as FindOptionsWhere<WorkOrder>, text ? [{ woNumber: ILike(`%${text}%`) }, { title: ILike(`%${text}%`) }] as FindOptionsWhere<WorkOrder>[] : [{}]), relations: { group: true, createdBy: true }, order: { createdAt: order }, take: 200 });
      items = rows.filter((w) => state === "any" || statusIn(["Open", "In Progress", "On Hold", "Completed", "Cancelled"]).includes(w.status)).map((w) => ({ id: w.workOrderId, type, number: w.woNumber, title: w.title, status: w.status, group: w.group?.groupName ?? null, raisedBy: w.createdBy?.fullName ?? null, createdAt: w.createdAt }));
    } else {
      const rows = await this.requests.find({ where: this.mix<ServiceRequest>({ ...(since ? { createdAt: MoreThanOrEqual(since) } : {}), ...(whoId ? { requestedBy: { userId: whoId } } : {}), ...(wantGroup && r.assignmentGroup ? { assignmentGroup: { groupId: r.assignmentGroup.groupId } } : {}) } as FindOptionsWhere<ServiceRequest>, text ? [{ requestNumber: ILike(`%${text}%`) }, { catalog: { catalogName: ILike(`%${text}%`) } }] as FindOptionsWhere<ServiceRequest>[] : [{}]), relations: { catalog: true, assignmentGroup: true, requestedBy: true }, order: { createdAt: order }, take: 200 });
      items = rows.filter((x) => state === "any" || statusIn(["Pending Approval", "Returned", "Approved", "In Progress", "On Hold", "Fulfilled", "Closed", "Rejected", "Cancelled"]).includes(x.status)).map((x) => ({ id: x.requestId, type, number: x.requestNumber, title: x.catalog?.catalogName ?? "Service request", status: x.status, group: x.assignmentGroup?.groupName ?? null, raisedBy: x.requestedBy?.fullName ?? null, createdAt: x.createdAt }));
    }
    items = items.filter(keep);
    if (q.sort === "number") items.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    return { items: items.slice(0, 50), ...(notes.length ? { note: notes.join(" ") } : {}) };
  }

  /** Combines fixed conditions with an OR-list of text matches. */
  private mix<T extends object>(fixed: FindOptionsWhere<T>, ors: FindOptionsWhere<T>[]): FindOptionsWhere<T>[] {
    return ors.map((o) => ({ ...fixed, ...o }) as FindOptionsWhere<T>);
  }

  // ── Work notes ──
  async listNotes(requestId: number, actor: Actor) {
    await this.load(requestId, actor);
    return this.notes.find({ where: { request: { requestId } }, relations: { createdBy: true }, order: { createdAt: "DESC" } });
  }

  async addNote(requestId: number, actor: Actor, text: string) {
    const r = await this.load(requestId, actor);
    const t = text.trim();
    if (!t) throw new BadRequestException("Write the note first");
    const saved = await this.notes.save(this.notes.create({ request: r, text: t, createdBy: { userId: actor.userId } as never }));
    return this.notes.findOneOrFail({ where: { noteId: saved.noteId }, relations: { createdBy: true } });
  }
}
