import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";
import { isStaff } from "../../common/utils/roles.util";
import { CabAttendee, CabMeeting } from "./entities/cab-meeting.entity";
import { Change } from "./entities/change.entity";
import { ChangeApproval } from "./entities/change-approval.entity";
import { Actor, ChangesService } from "./changes.service";
import { ChangeSettings } from "./change-config";
import { ChangeConfigService } from "./change-config.service";
import { ChangeNotifier } from "./change-notifier.service";
import { findConflicts } from "./change-conflicts";
import { CabDecisionDto } from "./dto/change.dto";

const DAY = 86400000;
/** Used only until the CAB group has members configured in Groups. */
const FALLBACK_BOARD = ["Change Manager", "Service Delivery Manager", "Infrastructure Lead", "Application Lead", "Information Security Officer", "Service Desk Manager"];

@Injectable()
export class CabService {
  constructor(
    @InjectRepository(CabMeeting) private meetings: Repository<CabMeeting>,
    @InjectRepository(Change) private changes: Repository<Change>,
    @InjectRepository(ChangeApproval) private approvals: Repository<ChangeApproval>,
    private changesSvc: ChangesService,
    private cfg: ChangeConfigService,
    private notifier: ChangeNotifier,
  ) {}

  private requireStaff(actor: Actor) {
    if (!isStaff(actor.roles)) throw new ForbiddenException("The CAB workbench is for change staff.");
  }
  private cabGroup(s: ChangeSettings) { return s.approval.groups.find((g) => g.name === "CAB"); }

  private nextOccurrence(s: ChangeSettings): Date {
    const g = this.cabGroup(s);
    const [h, m] = (g?.meetTime || "15:00").split(":").map(Number);
    const day = g?.meetDay ?? 2;
    const d = new Date(); d.setHours(h, m, 0, 0);
    while (d.getDay() !== day || d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    return d;
  }

  /** The meeting in progress or the next planned one; created from the CAB group's schedule and members when none exists. */
  async currentMeeting(s?: ChangeSettings): Promise<CabMeeting> {
    const open = await this.meetings.findOne({ where: { status: In(["In Progress", "Planned"]) }, order: { status: "DESC", scheduledAt: "ASC" } });
    if (open) return open;
    const cfg = s ?? (await this.cfg.effective());
    const g = this.cabGroup(cfg);
    const attendance: CabAttendee[] = g?.members.length
      ? g.members.map((m) => ({ name: m.name, role: m.userId === g.lead ? "Chair" : "Member", present: false }))
      : FALLBACK_BOARD.map((name, i) => ({ name, role: i === 0 ? "Chair" : "Member", present: false }));
    return this.meetings.save(this.meetings.create({
      title: "Weekly CAB", scheduledAt: this.nextOccurrence(cfg), location: g?.meets ?? "", chair: attendance.find((a) => a.role === "Chair")?.name, attendance,
    }));
  }

  private quorum(m: CabMeeting, s: ChangeSettings) {
    const total = m.attendance.length, present = m.attendance.filter((a) => a.present).length;
    const need = this.cabGroup(s)?.quorum || Math.floor(total / 2) + 1;
    return { present, total, need, met: total > 0 && present >= need };
  }

  /** Changes whose open approval stage is the CAB. */
  private async agenda() {
    const pending = await this.approvals.createQueryBuilder("a")
      .innerJoinAndSelect("a.change", "ch").leftJoinAndSelect("ch.requestedBy", "rb").leftJoinAndSelect("ch.assignedTo", "at")
      .where("a.status = 'Pending'").andWhere("a.approvalGroup = 'CAB'").andWhere("ch.state = 'Authorize'")
      .andWhere("a.stage = (SELECT MIN(p.stage) FROM change_approvals p WHERE p.change_id = a.change_id AND p.status = 'Pending')")
      .orderBy("ch.plannedStart", "ASC").getMany();
    const seen = new Set<number>();
    return pending.filter((a) => (seen.has(a.change.changeId) ? false : (seen.add(a.change.changeId), true)));
  }

  async workbench(actor: Actor) {
    this.requireStaff(actor);
    const s = await this.cfg.effective();
    const meeting = await this.currentMeeting(s);
    const live = await this.changes.createQueryBuilder("c")
      .where("c.state IN ('New','Assess','Authorize','Scheduled','Implement')").andWhere("c.plannedStart IS NOT NULL").getMany();
    const windows = s.windows.filter((w) => w.active);

    const authorisation = await Promise.all((await this.agenda()).map(async (a) => ({
      change: a.change,
      earlierApprovals: (await this.approvals.find({ where: { change: { changeId: a.change.changeId } }, order: { stage: "ASC" } })).filter((x) => x.stage < a.stage && x.status === "Approved"),
      conflicts: findConflicts(a.change, live, windows),
    })));
    const emergencies = await this.changes.find({
      where: { changeType: In(s.models.filter((m) => m.base === "Emergency").map((m) => m.name)), cabReviewedAt: IsNull(), state: In(["Scheduled", "Implement", "Review", "Closed"]) }, order: { createdAt: "DESC" },
    });
    const since = new Date(Date.now() - 30 * DAY);
    const emgNames = s.models.filter((m) => m.base === "Emergency").map((m) => m.name);
    const pirs = await this.changes.createQueryBuilder("c")
      .where("c.state IN ('Review','Closed')").andWhere("c.updatedAt >= :since", { since })
      .andWhere("(c.implementationOutcome IN ('Failed','Backed out','Successful with issues') OR (c.state = 'Review' AND c.changeType IN (:...emg)))", { emg: emgNames.length ? emgNames : [""] })
      .orderBy("c.updatedAt", "DESC").getMany();
    const horizon = new Date(Date.now() + 14 * DAY);
    const forward = await this.changes.createQueryBuilder("c")
      .where("c.state IN ('New','Assess','Authorize','Scheduled','Implement')").andWhere("c.plannedStart IS NOT NULL").andWhere("c.plannedStart <= :h", { h: horizon }).andWhere("c.plannedEnd >= :n", { n: new Date() })
      .orderBy("c.plannedStart", "ASC").getMany();
    const history = await this.meetings.find({ where: { status: "Ended" }, order: { endedAt: "DESC" }, take: 5 });
    const g = this.cabGroup(s);
    const rule = s.approval.rules.find((r) => r.active && r.stages.some((st) => st.grp === "CAB"));
    return {
      meeting, quorum: this.quorum(meeting, s), history, authorisation, emergencies, pirs, forward,
      policy: `Decisions need a quorum of ${this.quorum(meeting, s).need} of ${meeting.attendance.length} board members present.` + (rule ? ` Default CAB rule: ${g?.defaultRule ?? "Majority of members"}.` : ""),
      membersConfigured: !!g?.members.length,
    };
  }

  async start(id: number, actor: Actor) {
    this.requireStaff(actor);
    const s = await this.cfg.effective();
    const m = await this.meetings.findOne({ where: { id } });
    if (!m) throw new NotFoundException("Meeting not found");
    if (m.status !== "Planned") throw new BadRequestException("This meeting has already started.");
    if (!this.quorum(m, s).met) throw new BadRequestException(`Mark attendance first: a quorum needs ${this.quorum(m, s).need} members present.`);
    m.status = "In Progress"; m.startedAt = new Date();
    const saved = await this.meetings.save(m);
    for (const a of await this.agenda()) await this.notifier.notify("e8", a.change.changeId);
    return saved;
  }

  async setAttendance(id: number, attendance: CabAttendee[], actor: Actor) {
    this.requireStaff(actor);
    const m = await this.meetings.findOne({ where: { id } });
    if (!m) throw new NotFoundException("Meeting not found");
    if (m.status === "Ended") throw new BadRequestException("The meeting has ended.");
    // Only the people already on the board list can be marked present or absent.
    m.attendance = m.attendance.map((a) => ({ ...a, present: !!attendance.find((x) => x.name === a.name)?.present }));
    return this.meetings.save(m);
  }

  async end(id: number, minutes: string | undefined, actor: Actor) {
    this.requireStaff(actor);
    const s = await this.cfg.effective();
    const m = await this.meetings.findOne({ where: { id } });
    if (!m) throw new NotFoundException("Meeting not found");
    if (m.status !== "In Progress") throw new BadRequestException("Start the meeting before ending it.");
    m.status = "Ended"; m.endedAt = new Date(); m.minutes = minutes;
    // Emergency changes listed at this meeting count as reviewed once the minutes are published.
    const emg = s.models.filter((x) => x.base === "Emergency").map((x) => x.name);
    if (emg.length) await this.changes.update({ changeType: In(emg), cabReviewedAt: IsNull(), state: In(["Scheduled", "Implement", "Review", "Closed"]) }, { cabReviewedAt: new Date() });
    return this.meetings.save(m);
  }

  /** Record the CAB's decision on a change — needs a running meeting with quorum. */
  async decide(meetingId: number, dto: CabDecisionDto, actor: Actor) {
    this.requireStaff(actor);
    const s = await this.cfg.effective();
    const m = await this.meetings.findOne({ where: { id: meetingId } });
    if (!m) throw new NotFoundException("Meeting not found");
    if (m.status !== "In Progress") throw new BadRequestException("Decisions can only be recorded while the meeting is in progress.");
    if (!this.quorum(m, s).met) throw new BadRequestException("There is no quorum, so decisions cannot be recorded.");
    return this.changesSvc.decideStage(dto.changeId, "CAB", dto.decision, dto.comment, actor, meetingId);
  }
}
