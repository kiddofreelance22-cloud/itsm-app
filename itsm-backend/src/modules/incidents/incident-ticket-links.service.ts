import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, ILike, MoreThanOrEqual, Repository } from "typeorm";
import { ServiceRequest } from "../requests/entities/request.entity";
import { Change } from "../changes/entities/change.entity";
import { Problem } from "../problems/entities/problem.entity";
import { WorkOrder } from "../itsm-config/entities/work-order.entity";
import { Incident } from "./entities/incident.entity";
import { IncidentTicketLink, IncidentLinkTargetType } from "./entities/incident-ticket-link.entity";
import { LinkCandidatesQueryDto } from "../requests/dto/request-links.dto";

export interface Ticket {
  id?: string | number;
  type: IncidentLinkTargetType;
  number: string;
  title: string;
  status: string;
  group: string | null;
  groupId?: number | null;
  raisedBy: string | null;
  raisedById?: number | null;
  createdAt: Date | null;
}
export interface IncidentTicketLinkView {
  linkId: number;
  type: IncidentLinkTargetType;
  number: string;
  title: string;
  status: string;
  relation: string;
  details: null;
  group: string | null;
  direction: "out" | "in";
  createdAt: Date;
  targetId: string | number | null;
}

const LABEL: Record<IncidentLinkTargetType, string> = {
  request: "Service request", incident: "Incident", change: "Change", problem: "Problem", work_order: "Work order",
};
const CLOSED: Record<IncidentLinkTargetType, string[]> = {
  request: ["Fulfilled", "Closed", "Rejected", "Cancelled"],
  incident: ["Resolved", "Closed", "Cancelled"],
  change: ["Completed", "Cancelled"],
  problem: ["Resolved", "Closed"],
  work_order: ["Completed", "Cancelled"],
};

@Injectable()
export class IncidentTicketLinksService {
  constructor(
    @InjectRepository(IncidentTicketLink) private readonly links: Repository<IncidentTicketLink>,
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    @InjectRepository(ServiceRequest) private readonly requests: Repository<ServiceRequest>,
    @InjectRepository(Change) private readonly changes: Repository<Change>,
    @InjectRepository(Problem) private readonly problems: Repository<Problem>,
    @InjectRepository(WorkOrder) private readonly workOrders: Repository<WorkOrder>,
  ) {}

  private async owner(id: string): Promise<Incident> {
    const incident = await this.incidents.findOne({
      where: [{ incidentId: id }, { incidentCode: ILike(id) }],
      relations: { assignmentGroup: true, createdBy: true },
    });
    if (!incident) throw new NotFoundException(`Incident ${id} not found`);
    return incident;
  }

  private mix<T extends object>(fixed: FindOptionsWhere<T>, ors: FindOptionsWhere<T>[]): FindOptionsWhere<T>[] {
    return ors.map((condition) => ({ ...fixed, ...condition }) as FindOptionsWhere<T>);
  }

  private async resolve(type: IncidentLinkTargetType, number: string): Promise<Ticket | null> {
    if (type === "incident") {
      const i = await this.incidents.findOne({ where: [{ incidentCode: ILike(number) }, { incidentId: number }], relations: { assignmentGroup: true, createdBy: true } });
      return i ? { id: i.incidentId, type, number: i.incidentCode, title: i.title, status: i.status, group: i.assignmentGroup?.groupName ?? null, groupId: i.assignmentGroup?.groupId ?? null, raisedBy: i.createdBy?.fullName ?? null, raisedById: i.createdBy?.userId ?? null, createdAt: i.createdAt } : null;
    }
    if (type === "request") {
      const r = await this.requests.findOne({ where: { requestNumber: ILike(number) }, relations: { catalog: true, assignmentGroup: true, requestedBy: true } });
      return r ? { id: r.requestId, type, number: r.requestNumber, title: r.catalog?.catalogName ?? "Service request", status: r.status, group: r.assignmentGroup?.groupName ?? null, groupId: r.assignmentGroup?.groupId ?? null, raisedBy: r.requestedBy?.fullName ?? null, raisedById: r.requestedBy?.userId ?? null, createdAt: r.createdAt } : null;
    }
    if (type === "change") {
      const c = await this.changes.findOne({ where: { changeCode: ILike(number) } });
      return c ? { type, number: c.changeCode, title: c.shortDescription, status: c.status, group: c.assignmentGroup ?? null, raisedBy: null, createdAt: c.createdAt } : null;
    }
    if (type === "problem") {
      const p = await this.problems.findOne({ where: { problemCode: ILike(number) } });
      return p ? { type, number: p.problemCode, title: p.shortDescription, status: p.status, group: null, raisedBy: null, createdAt: p.createdAt } : null;
    }
    const w = await this.workOrders.findOne({ where: { woNumber: ILike(number) }, relations: { group: true, createdBy: true } });
    return w ? { id: w.workOrderId, type, number: w.woNumber, title: w.title, status: w.status, group: w.group?.groupName ?? null, groupId: w.group?.groupId ?? null, raisedBy: w.createdBy?.fullName ?? null, raisedById: w.createdBy?.userId ?? null, createdAt: w.createdAt } : null;
  }

  async list(id: string): Promise<IncidentTicketLinkView[]> {
    const owner = await this.owner(id);
    const rows = await this.links.find({ where: { incident: { incidentId: owner.incidentId } }, order: { linkId: "ASC" } });
    const result: IncidentTicketLinkView[] = [];
    for (const row of rows) {
      const ticket = await this.resolve(row.targetType, row.targetRef);
      result.push({
        linkId: row.linkId, type: row.targetType, number: ticket?.number ?? row.targetRef,
        title: ticket?.title ?? "", status: ticket?.status ?? "Unavailable", relation: row.relation,
        details: null, group: ticket?.group ?? null, direction: "out", createdAt: row.createdAt, targetId: ticket?.id ?? null,
      });
    }
    const incoming = await this.links.find({ where: { targetType: "incident", targetRef: owner.incidentCode }, relations: { incident: true }, order: { linkId: "ASC" } });
    for (const row of incoming) {
      const linked = row.incident;
      result.push({
        linkId: row.linkId, type: "incident", number: linked.incidentCode, title: linked.title,
        status: linked.status, relation: row.relation, details: null, group: null, direction: "in",
        createdAt: row.createdAt, targetId: linked.incidentId,
      });
    }
    return result;
  }

  async candidates(id: string, userId: number, query: LinkCandidatesQueryDto) {
    const owner = await this.owner(id);
    const type = query.type;
    const text = query.q?.trim().toLowerCase();
    const pattern = text ? `%${text}%` : undefined;
    const closed = new Set(CLOSED[type]);
    const since = query.raised && query.raised !== "any" ? Date.now() - Number(query.raised) * 86400000 : null;
    const createdAfter = since ? new Date(since) : undefined;
    const ownerLinks = await this.links.find({ where: { incident: { incidentId: owner.incidentId } } });
    const incoming = type === "incident"
      ? await this.links.find({ where: { targetType: "incident", targetRef: owner.incidentCode }, relations: { incident: true } })
      : [];
    const linked = new Set([
      ...ownerLinks.map((x) => `${x.targetType}:${x.targetRef.toUpperCase()}`),
      ...incoming.map((x) => `${x.targetType}:${x.incident.incidentCode.toUpperCase()}`),
    ]);
    let items: Ticket[] = [];

    if (type === "incident") {
      const fixed = {
        ...(createdAfter ? { createdAt: MoreThanOrEqual(createdAfter) } : {}),
        ...(query.raisedBy === "me" ? { createdBy: { userId } } : {}),
        ...(query.match === "requester" && owner.createdBy?.userId ? { createdBy: { userId: owner.createdBy.userId } } : {}),
        ...(query.match === "group" && owner.assignmentGroup?.groupId ? { assignmentGroup: { groupId: owner.assignmentGroup.groupId } } : {}),
      } as FindOptionsWhere<Incident>;
      const where = this.mix<Incident>(fixed, pattern
        ? [{ incidentCode: ILike(pattern) }, { title: ILike(pattern) }]
        : [{}]);
      const rows = await this.incidents.find({ where, relations: { assignmentGroup: true, createdBy: true }, order: { createdAt: query.sort === "oldest" ? "ASC" : "DESC" }, take: 200 });
      items = rows.filter((x) => x.incidentId !== owner.incidentId).map((x) => ({ id: x.incidentId, type, number: x.incidentCode, title: x.title, status: x.status, group: x.assignmentGroup?.groupName ?? null, groupId: x.assignmentGroup?.groupId ?? null, raisedBy: x.createdBy?.fullName ?? null, raisedById: x.createdBy?.userId ?? null, createdAt: x.createdAt }));
    } else if (type === "request") {
      const fixed = {
        ...(createdAfter ? { createdAt: MoreThanOrEqual(createdAfter) } : {}),
        ...(query.raisedBy === "me" ? { requestedBy: { userId } } : {}),
        ...(query.match === "requester" && owner.createdBy?.userId ? { requestedBy: { userId: owner.createdBy.userId } } : {}),
        ...(query.match === "group" && owner.assignmentGroup?.groupId ? { assignmentGroup: { groupId: owner.assignmentGroup.groupId } } : {}),
      } as FindOptionsWhere<ServiceRequest>;
      const where = this.mix<ServiceRequest>(fixed, pattern
        ? [{ requestNumber: ILike(pattern) }, { catalog: { catalogName: ILike(pattern) } }]
        : [{}]);
      const rows = await this.requests.find({ where, relations: { catalog: true, assignmentGroup: true, requestedBy: true }, order: { createdAt: query.sort === "oldest" ? "ASC" : "DESC" }, take: 200 });
      items = rows.map((x) => ({ id: x.requestId, type, number: x.requestNumber, title: x.catalog?.catalogName ?? "Service request", status: x.status, group: x.assignmentGroup?.groupName ?? null, groupId: x.assignmentGroup?.groupId ?? null, raisedBy: x.requestedBy?.fullName ?? null, raisedById: x.requestedBy?.userId ?? null, createdAt: x.createdAt }));
    } else if (type === "change") {
      const fixed = { ...(createdAfter ? { createdAt: MoreThanOrEqual(createdAfter) } : {}) } as FindOptionsWhere<Change>;
      const where = this.mix<Change>(fixed, pattern
        ? [{ changeCode: ILike(pattern) }, { shortDescription: ILike(pattern) }]
        : [{}]);
      const rows = await this.changes.find({ where, order: { createdAt: query.sort === "oldest" ? "ASC" : "DESC" }, take: 200 });
      items = rows.map((x) => ({ type, number: x.changeCode, title: x.shortDescription, status: x.status, group: x.assignmentGroup ?? null, raisedBy: null, createdAt: x.createdAt }));
    } else if (type === "problem") {
      const fixed = { ...(createdAfter ? { createdAt: MoreThanOrEqual(createdAfter) } : {}) } as FindOptionsWhere<Problem>;
      const where = this.mix<Problem>(fixed, pattern
        ? [{ problemCode: ILike(pattern) }, { shortDescription: ILike(pattern) }]
        : [{}]);
      const rows = await this.problems.find({ where, order: { createdAt: query.sort === "oldest" ? "ASC" : "DESC" }, take: 200 });
      items = rows.map((x) => ({ type, number: x.problemCode, title: x.shortDescription, status: x.status, group: null, raisedBy: null, createdAt: x.createdAt }));
    } else {
      const fixed = {
        ...(createdAfter ? { createdAt: MoreThanOrEqual(createdAfter) } : {}),
        ...(query.raisedBy === "me" ? { createdBy: { userId } } : {}),
        ...(query.match === "requester" && owner.createdBy?.userId ? { createdBy: { userId: owner.createdBy.userId } } : {}),
        ...(query.match === "group" && owner.assignmentGroup?.groupId ? { group: { groupId: owner.assignmentGroup.groupId } } : {}),
      } as FindOptionsWhere<WorkOrder>;
      const where = this.mix<WorkOrder>(fixed, pattern
        ? [{ woNumber: ILike(pattern) }, { title: ILike(pattern) }]
        : [{}]);
      const rows = await this.workOrders.find({ where, relations: { group: true, createdBy: true }, order: { createdAt: query.sort === "oldest" ? "ASC" : "DESC" }, take: 200 });
      items = rows.map((x) => ({ id: x.workOrderId, type, number: x.woNumber, title: x.title, status: x.status, group: x.group?.groupName ?? null, groupId: x.group?.groupId ?? null, raisedBy: x.createdBy?.fullName ?? null, raisedById: x.createdBy?.userId ?? null, createdAt: x.createdAt }));
    }

    items = items.filter((item) => {
      if (linked.has(`${item.type}:${item.number.toUpperCase()}`)) return false;
      if (query.state === "closed" && !closed.has(item.status)) return false;
      if (query.state === "open" && closed.has(item.status)) return false;
      if (text && !`${item.number} ${item.title}`.toLowerCase().includes(text)) return false;
      if (since && (!item.createdAt || item.createdAt.getTime() < since)) return false;
      if (query.raisedBy === "me" && !["change", "problem"].includes(type) && item.raisedById !== userId) return false;
      if (query.match === "requester" && !["change", "problem"].includes(type) && item.raisedById !== owner.createdBy?.userId) return false;
      if (query.match === "group" && !["change", "problem"].includes(type)
        && owner.assignmentGroup?.groupId && item.groupId !== owner.assignmentGroup.groupId) return false;
      return true;
    });
    const note = query.raisedBy === "me" || query.match === "requester"
      ? ["change", "problem"].includes(type) ? `${LABEL[type]}s do not record who raised them, so that filter was not applied.` : undefined
      : query.match === "group" && ["change", "problem"].includes(type)
        ? `${LABEL[type]}s have no assignment group, so that filter was not applied.`
        : undefined;
    if (query.sort === "number") items.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    return { items: items.slice(0, 50), ...(note ? { note } : {}) };
  }

  async attach(id: string, userId: number, type: IncidentLinkTargetType, number: string, relation = "Related to") {
    const owner = await this.owner(id);
    if (["Closed", "Cancelled"].includes(owner.status)) throw new BadRequestException(`This incident is ${owner.status.toLowerCase()} and locked.`);
    const ticket = await this.resolve(type, number);
    if (!ticket) throw new NotFoundException(`No ${LABEL[type].toLowerCase()} numbered ${number.trim()} was found`);
    if (type === "incident" && ticket.id === owner.incidentId) throw new BadRequestException("An incident cannot be linked to itself.");
    if (await this.links.findOne({ where: { incident: { incidentId: owner.incidentId }, targetType: type, targetRef: ticket.number } })) {
      throw new ConflictException(`${ticket.number} is already linked to this incident`);
    }
    if (type === "incident" && await this.links.findOne({ where: { incident: { incidentId: ticket.id as string }, targetType: "incident", targetRef: owner.incidentCode } })) {
      throw new ConflictException(`${ticket.number} is already linked to this incident`);
    }
    await this.links.save(this.links.create({ incident: owner, targetType: type, targetRef: ticket.number, relation, createdBy: { userId } as never }));
    return this.list(owner.incidentId);
  }

  async remove(id: string, linkId: number) {
    const owner = await this.owner(id);
    if (["Closed", "Cancelled"].includes(owner.status)) throw new BadRequestException(`This incident is ${owner.status.toLowerCase()} and locked.`);
    let link = await this.links.findOne({ where: { linkId, incident: { incidentId: owner.incidentId } } });
    if (!link) link = await this.links.findOne({ where: { linkId, targetType: "incident", targetRef: owner.incidentCode } });
    if (!link) throw new NotFoundException("That link is not on this incident");
    await this.links.remove(link);
    return this.list(owner.incidentId);
  }
}
