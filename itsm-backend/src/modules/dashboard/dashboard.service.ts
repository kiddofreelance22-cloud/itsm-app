import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, IsNull, Not, In, MoreThan, Brackets, SelectQueryBuilder } from "typeorm";
import { Incident } from "../incidents/entities/incident.entity";
import { ServiceRequest } from "../requests/entities/request.entity";
import { User } from "../users/entities/user.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { Task } from "../tasks/entities/task.entity";
import { Problem } from "../problems/entities/problem.entity";
import { Change } from "../changes/entities/change.entity";
import { RequestsService } from "../requests/requests.service";

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Incident) private incidentRepo: Repository<Incident>,
    @InjectRepository(ServiceRequest) private requestRepo: Repository<ServiceRequest>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(AssignmentGroup) private groupRepo: Repository<AssignmentGroup>,
    @InjectRepository(Task) private taskRepo: Repository<Task>,
    @InjectRepository(Problem) private problemRepo: Repository<Problem>,
    @InjectRepository(Change) private changeRepo: Repository<Change>,
    private requestsService: RequestsService,
  ) {}

  /**
   * Analyst-scoped dashboard. Everything here is filtered down to what the
   * *current* analyst can actually act on: incidents/tasks/problems/changes
   * assigned to them, plus the queues of the assignment groups they belong
   * to — never system-wide totals. (System-wide reporting, if ever needed,
   * belongs on a separate Admin/Ops dashboard endpoint, not this one.)
   */
  async getAnalystStats(userId: number, from?: Date, to?: Date) {
    const dateFilter = from && to ? Between(from, to) : undefined;
    const baseWhere = dateFilter ? { createdAt: dateFilter } : {};

    // Groups this analyst belongs to — the scope boundary for everything below.
    const groups = await this.groupRepo.find({ relations: { members: true } });
    const myGroups = groups.filter((g) => g.members?.some((m) => m.userId === userId));
    const userGroupIds = myGroups.map((g) => g.groupId);

    // An incident is "mine" if it's assigned to me, or it's unassigned but
    // sitting in one of my groups' queues.
    const mineOrMyGroupQueue: any[] = [{ assignedTo: { userId } }];
    if (userGroupIds.length > 0) {
      mineOrMyGroupQueue.push({ assignmentGroup: { groupId: In(userGroupIds) }, assignedTo: IsNull() });
    }
    const scoped = (extra: Record<string, any> = {}) =>
      mineOrMyGroupQueue.map((clause) => ({ ...clause, ...baseWhere, ...extra }));

    // Incident counts (analyst-scoped)
    const [
      totalIncidents,
      openIncidents,
      inProgressIncidents,
      assignedIncidents,
      assignedOpenIncidents,
      assignedInProgressIncidents,
      assignedOnHoldIncidents,
      assignedResolvedToday,
      resolvedToday,
      myAssignedIncidents,
      totalResolvedInWorkgroups,
      totalIncidentsInWorkgroups,
      totalResolvedInAllWorkgroups,
    ] = await Promise.all([
      this.incidentRepo.count({ where: scoped() }),
      this.incidentRepo.count({ where: scoped({ status: In(["Open", "Assigned"]) }) }),
      this.incidentRepo.count({ where: scoped({ status: "In Progress" }) }),
      this.incidentRepo.count({ where: { assignedTo: { userId }, status: Not(In(["Closed", "Resolved"])) } }),
      this.incidentRepo.count({ where: { assignedTo: { userId }, status: In(["Open", "Assigned"]) } }),
      this.incidentRepo.count({ where: { assignedTo: { userId }, status: "In Progress" } }),
      this.incidentRepo.count({ where: { assignedTo: { userId }, status: "On Hold" } }),
      this.incidentRepo.count({
        where: { assignedTo: { userId }, status: "Resolved", resolvedAt: Between(this.todayStart(), new Date()) },
      }),
      this.incidentRepo.count({
        where: scoped({ status: "Resolved", resolvedAt: Between(this.todayStart(), new Date()) }),
      }),
      this.incidentRepo.count({ where: { assignedTo: { userId } } }),
      this.incidentRepo.count({ where: scoped({ status: "Resolved" }) }),
      // Workgroup-wide totals (all incidents in user's groups, not just scoped)
      this.incidentRepo.count({
        where: userGroupIds.length > 0 
          ? { assignmentGroup: { groupId: In(userGroupIds) }, status: Not(In(["Closed", "Resolved"])) }
          : { assignedTo: { userId }, status: Not(In(["Closed", "Resolved"])) },
      }),
      this.incidentRepo.count({
        where: userGroupIds.length > 0 
          ? { assignmentGroup: { groupId: In(userGroupIds) }, status: "Resolved" }
          : { assignedTo: { userId }, status: "Resolved" },
      }),
    ]);

    // Service Requests — what this analyst works on: assigned to me, or approved and unclaimed in one of my
    // groups' queues. (It used to count requests I had raised myself, which is the end-user view, not the analyst's.)
    const reqQueue: any[] = [{ assignedTo: { userId } }];
    if (userGroupIds.length > 0) reqQueue.push({ assignmentGroup: { groupId: In(userGroupIds) }, assignedTo: IsNull(), status: "Approved" });
    const reqScope = (extra: Record<string, unknown> = {}) => reqQueue.map((w) => ({ ...w, ...extra }));
    const FULFILMENT = ["Approved", "In Progress", "On Hold", "Fulfilled", "Closed"];
    const [totalRequests, openRequests, inProgressRequests, completedToday] = await Promise.all([
      this.requestRepo.count({ where: reqScope({ ...baseWhere, status: In(FULFILMENT) }) }),
      // Waiting to be started: approved, in my queue or assigned to me.
      this.requestRepo.count({ where: reqScope({ ...baseWhere, status: "Approved" }) }),
      this.requestRepo.count({ where: [{ assignedTo: { userId }, status: In(["In Progress", "On Hold"]) }] }),
      this.requestRepo.count({ where: [{ assignedTo: { userId }, fulfilledAt: Between(this.todayStart(), new Date()) }] }),
    ]);

    // Problem counts (assigned to me)
    const [totalProblems, openProblems, inProgressProblems, problemsResolvedToday] = await Promise.all([
      this.problemRepo.count({ where: { assignedTo: { userId }, ...baseWhere } }),
      this.problemRepo.count({ where: { assignedTo: { userId }, ...baseWhere, status: "Open" } }),
      this.problemRepo.count({ where: { assignedTo: { userId }, ...baseWhere, status: "In Progress" } }),
      this.problemRepo.count({
        where: { assignedTo: { userId }, resolvedAt: Between(this.todayStart(), new Date()) },
      }),
    ]);

    // Change counts: changes the analyst works on or must decide — assigned to me, unassigned in one of my workgroups' queues
    // (a change names its assignment group by workgroup name), or waiting for my approval. Cancelled changes are left out.
    const myGroupNames = myGroups.map((g) => g.groupName);
    const countChanges = (states: string[], extra?: (qb: SelectQueryBuilder<Change>) => void) => {
      const qb = this.changeRepo.createQueryBuilder("c").where("c.state IN (:...states)", { states })
        .andWhere(new Brackets((w) => {
          w.where("c.assigned_to = :uid", { uid: userId });
          if (myGroupNames.length) w.orWhere("(c.assignment_group IN (:...gn) AND c.assigned_to IS NULL)", { gn: myGroupNames });
          w.orWhere("EXISTS (SELECT 1 FROM change_approvals ap WHERE ap.change_id = c.change_id AND ap.approver_id = :uid AND ap.status = 'Pending')", { uid: userId });
        }));
      if (from && to) qb.andWhere("c.created_at BETWEEN :cf AND :ct", { cf: from, ct: to });
      extra?.(qb);
      return qb.getCount();
    };
    const [openChanges, inProgressChanges, changesCompletedToday] = await Promise.all([
      countChanges(["New", "Assess", "Authorize", "Scheduled"]),
      countChanges(["Implement", "Review"]),
      countChanges(["Closed"], (qb) => qb.andWhere("c.completed_at >= :today", { today: this.todayStart() })),
    ]);
    const totalChanges = openChanges + inProgressChanges;

    // Task counts (assigned to me)
    const [totalTasks, openTasks, overdueTasks] = await Promise.all([
      this.taskRepo.count({ where: { assignedTo: { userId }, ...baseWhere } }),
      this.taskRepo.count({ where: { assignedTo: { userId }, ...baseWhere, status: "Open" } }),
      this.taskRepo
        .createQueryBuilder("task")
        .where("task.assigned_to = :userId", { userId })
        .andWhere("task.due_date IS NOT NULL")
        .andWhere("task.due_date < :now", { now: new Date() })
        .andWhere("task.status NOT IN (:...done)", { done: ["Completed", "Cancelled"] })
        .getCount(),
    ]);

    // Approvals — the same list the Approve Service Requests screen shows: waiting on me, and ones I decided.
    let myApprovals: Awaited<ReturnType<RequestsService["approvalsFor"]>> = [];
    try { myApprovals = await this.requestsService.approvalsFor({ userId, roles: [] }); } catch { /* approvals card just shows 0 */ }
    const pendingApprovals = myApprovals.filter((a) => a.state === "Awaiting me").length;
    const approvedApprovals = myApprovals.filter((a) => a.state === "Approved").length;

    // SLA stats — scoped to incidents assigned to me.
    const slaBreached = await this.incidentRepo.count({ where: { assignedTo: { userId }, slaBreached: true } });
    const slaTotal = await this.incidentRepo.count({ where: { assignedTo: { userId } } });
    // Same definition as the Admin Dashboard: an incident meets SLA unless its Resolution SLA is breached.
    const slaMet = Math.max(0, slaTotal - slaBreached);
    const slaAtRisk = await this.incidentRepo.count({
      where: { assignedTo: { userId }, slaBreached: false, status: Not(In(["Resolved", "Closed"])), slaResolutionTarget: Between(new Date(), new Date(Date.now() + 4 * 3600000)) },
    });

    // Unassigned tickets — only within groups I'm a member of.
    const unassignedByGroup = await Promise.all(
      myGroups.map(async (g) => ({
        groupId: g.groupId,
        groupName: g.groupName,
        incidentCount: await this.incidentRepo.count({
          where: { assignmentGroup: { groupId: g.groupId }, assignedTo: IsNull() },
        }),
        // Approved service requests nobody has claimed yet (these show in the Service Request List as "Claim").
        requestCount: await this.requestRepo.count({
          where: { assignmentGroup: { groupId: g.groupId }, assignedTo: IsNull(), status: "Approved" },
        }),
      }))
    );

    // Priority distribution — within my scope (assigned to me / my group queues)
    const priorities = ["Low", "Medium", "High", "Critical"] as const;
    const byPriority = await Promise.all(
      priorities.map(async (p) => ({
        priority: p,
        count: await this.incidentRepo.count({ where: scoped({ priority: p }) }),
      }))
    );

    // Status distribution — within my scope
    const statuses = ["Open", "Assigned", "In Progress", "On Hold", "Resolved", "Closed"] as const;
    const byStatus = await Promise.all(
      statuses.map(async (s) => ({
        status: s,
        count: await this.incidentRepo.count({ where: scoped({ status: s as any }) }),
      }))
    );

    // My open incidents (assigned to me, OR unassigned in my groups) —
    // "open" must exclude both terminal statuses, not just Closed.
    const myOpenIncidentsWhere: any[] = [
      { assignedTo: { userId }, status: Not(In(["Closed", "Resolved"])) },
    ];
    if (userGroupIds.length > 0) {
      myOpenIncidentsWhere.push({
        assignmentGroup: { groupId: In(userGroupIds) },
        assignedTo: IsNull(),
        status: Not(In(["Closed", "Resolved"])),
      });
    }

    const myOpenIncidents = await this.incidentRepo.find({
      where: myOpenIncidentsWhere,
      relations: { category: true, assignmentGroup: true },
      order: { createdAt: "DESC" },
    });

    // Service requests waiting on me: assigned to me and not finished, or approved and unclaimed in my groups
    const myOpenRequests = await this.requestRepo.find({
      where: reqScope({ status: In(["Approved", "In Progress", "On Hold"]) }),
      relations: { catalog: true, priority: true, assignmentGroup: true },
      order: { createdAt: "DESC" },
      take: 5,
    });

    // Unassigned tickets total — within my groups only.
    const unassignedTotal = unassignedByGroup.reduce((sum, g) => sum + g.incidentCount, 0);
    const unassignedRequestTotal = unassignedByGroup.reduce((sum, g) => sum + g.requestCount, 0);

    return {
      incidents: {
        total: totalIncidents,
        open: openIncidents,
        inProgress: inProgressIncidents,
        resolvedToday,
        mine: myAssignedIncidents,
        mineOpen: assignedIncidents, // All assigned incidents except Closed/Resolved
        mineInProgress: assignedInProgressIncidents,
        mineResolvedToday: assignedResolvedToday,
        assignedOpen: assignedOpenIncidents, // Only Open status
        assignedInProgress: assignedInProgressIncidents, // Only In Progress status
        assignedOnHold: assignedOnHoldIncidents, // Only On Hold status
        totalResolvedInWorkgroups, // Total resolved incidents in my assigned workgroups
        totalInWorkgroups: totalIncidentsInWorkgroups, // Total incidents in my workgroups (group-wide)
        totalResolvedInAllWorkgroups, // Total resolved incidents in my workgroups (group-wide)
      },
      serviceRequests: {
        total: totalRequests,
        open: openRequests,
        inProgress: inProgressRequests,
        completedToday,
      },
      problems: {
        total: totalProblems,
        open: openProblems,
        inProgress: inProgressProblems,
        resolvedToday: problemsResolvedToday,
      },
      changes: {
        total: totalChanges,
        open: openChanges,
        inProgress: inProgressChanges,
        completedToday: changesCompletedToday,
      },
      tasks: {
        total: totalTasks,
        open: openTasks,
        overdue: overdueTasks,
      },
      approvals: {
        total: pendingApprovals + approvedApprovals,
        pending: pendingApprovals,
        approved: approvedApprovals,
      },
      unassigned: {
        total: unassignedTotal + unassignedRequestTotal,
        incidents: unassignedTotal,
        serviceRequests: unassignedRequestTotal,
        tasks: 0,
      },
      sla: {
        metPercent: slaTotal > 0 ? Math.round((slaMet / slaTotal) * 100) : 0,
        met: slaMet,
        breached: slaBreached,
        atRisk: slaAtRisk,
        total: slaTotal,
      },
      byPriority,
      byStatus,
      byType: (() => {
        const rows = [
          { type: "Incidents", count: totalIncidents },
          { type: "Service Requests", count: totalRequests },
          { type: "Problems", count: totalProblems },
          { type: "Changes", count: totalChanges },
          { type: "Tasks", count: totalTasks },
        ];
        const grandTotal = rows.reduce((sum, r) => sum + r.count, 0);
        return rows.map((r) => ({
          ...r,
          percent: grandTotal > 0 ? Math.round((r.count / grandTotal) * 100) : 0,
        }));
      })(),
      myOpenIncidents: myOpenIncidents.map((i) => ({
        id: i.incidentCode ?? `INC${String(i.incidentId).padStart(6, "0")}`,
        summary: i.title,
        priority: i.priority,
        status: i.status,
        assignmentGroup: i.assignmentGroup?.groupName ?? "—",
        updatedAgo: this.timeAgo(i.updatedAt),
      })),
      myOpenRequests: myOpenRequests.map((r) => ({
        id: r.requestNumber ?? `REQ${String(r.requestId).padStart(8, "0")}`, // same number the Service Request list shows
        summary: r.catalog?.catalogName ?? "—",
        priority: r.priority?.priorityName ?? "—",
        priorityColor: r.priority?.color ?? null,
        status: r.status,
        assignmentGroup: r.assignmentGroup?.groupName ?? "—",
        updatedAgo: this.timeAgo(new Date(r.createdAt)),
      })),
      unassignedByGroup: unassignedByGroup.filter((g) => g.incidentCount > 0 || g.requestCount > 0),
    };
  }


  // ---------------------------------------------------------------------
  // END USER dashboard — only incidents this user reported.
  // ---------------------------------------------------------------------
  async getEndUserDashboard(userId: number) {
    const mine = await this.incidentRepo.find({
      where: [{ createdBy: { userId } }, { assignedTo: { userId } }, { loggedBy: userId }], // same set as My Incidents (IncidentsService.findAllForUser)
      relations: { assignmentGroup: true },
      order: { createdAt: "DESC" },
    });

    const row = (i: Incident) => ({
      incidentId: i.incidentId,
      id: i.incidentCode ?? i.incidentId,
      shortDescription: i.title,
      priority: i.priority,
      status: i.status,
      assignedWorkgroup: i.assignmentGroup?.groupName ?? "—",
      reported: i.createdAt,
      rating: i.feedbackRating ?? 0,
    });

    const open = mine.filter((i) => !["Resolved", "Closed"].includes(i.status));
    const resolved = mine.filter((i) => i.status === "Resolved");
    const closed = mine.filter((i) => i.status === "Closed");
    const needsFeedback = resolved.filter((i) => !i.feedbackRating);

    return {
      stats: {
        total: mine.length,
        open: open.length,
        resolved: resolved.length,
        closed: closed.length,
        needsFeedback: needsFeedback.length,
      },
      openTickets: open.map(row),
      recentlyClosed: closed.slice(0, 5).map(row),
      needsFeedback: needsFeedback.map((i) => ({ ...row(i), resolvedAt: i.resolvedAt ?? i.updatedAt })),
    };
  }

  // ---------------------------------------------------------------------
  // RESOLVER dashboard — my queue, my groups' unassigned queue, SLA risks.
  // Pending approvals come from the existing GET /approvals endpoint.
  // ---------------------------------------------------------------------
  async getResolverDashboard(userId: number) {
    const groups = await this.groupRepo.find({ relations: { members: true } });
    const myGroups = groups.filter((g) => g.members?.some((m) => m.userId === userId));
    const groupIds = myGroups.map((g) => g.groupId);
    const notDone = Not(In(["Resolved", "Closed"]));

    const myOpen = await this.incidentRepo.find({
      where: { assignedTo: { userId }, status: notDone },
      relations: { assignmentGroup: true, assignedTo: true },
      order: { updatedAt: "DESC" },
      take: 50,
    });

    const unassigned = groupIds.length
      ? await this.incidentRepo.find({
          where: { assignmentGroup: { groupId: In(groupIds) }, assignedTo: IsNull(), status: notDone },
          relations: { assignmentGroup: true },
          order: { createdAt: "ASC" },
          take: 50,
        })
      : [];

    const soon = Date.now() + 4 * 3600 * 1000;
    const slaLabel = (i: Incident) => {
      if (i.status === "On Hold") return "Paused";
      if (i.slaBreached) return "Breached";
      if (i.slaResolutionTarget) {
        const ms = new Date(i.slaResolutionTarget).getTime() - Date.now();
        if (ms <= 0) return "Breached";
        if (ms <= 4 * 3600 * 1000) return `Due in ${Math.max(1, Math.round(ms / 3600000))}h`;
      }
      return "On track";
    };
    const row = (i: Incident) => ({
      incidentId: i.incidentId,
      id: i.incidentCode ?? i.incidentId,
      shortDescription: i.title,
      priority: i.priority,
      status: i.status,
      sla: slaLabel(i),
      assignmentGroup: i.assignmentGroup?.groupName ?? "—",
      assignedTo: i.assignedTo?.fullName ?? "Unassigned",
      updatedAt: i.updatedAt,
      updatedAgo: this.timeAgo(i.updatedAt),
    });

    const slaAttention = myOpen
      .filter(
        (i) =>
          i.status !== "On Hold" &&
          (i.slaBreached ||
            (i.slaResolutionTarget && new Date(i.slaResolutionTarget).getTime() <= soon)),
      )
      .map((i) => ({
        incidentId: i.incidentId,
        id: i.incidentCode ?? i.incidentId,
        shortDescription: i.title,
        reason: i.slaBreached || new Date(i.slaResolutionTarget!).getTime() <= Date.now() ? "SLA breached" : "Due within 4h",
      }));

    return {
      stats: {
        assignedToMe: myOpen.length,
        myOpen: myOpen.filter((i) => ["Assigned", "In Progress"].includes(i.status)).length,
        slaPaused: myOpen.filter((i) => i.status === "On Hold").length,
        unassigned: unassigned.length,
      },
      myQueue: myOpen.map(row),
      unassigned: unassigned.map(row),
      slaAttention,
      groups: myGroups.map((g) => ({ groupId: g.groupId, groupName: g.groupName })),
    };
  }

  // ---------------------------------------------------------------------
  // ADMIN dashboard — system-wide totals. Restricted to Admin in the controller.
  // ---------------------------------------------------------------------
  async getAdminDashboard() {
    const notDone = Not(In(["Resolved", "Closed"]));
    const start = this.todayStart();

    const [
      totalIncidents, openIncidents, unassignedIncidents, resolvedToday,
      breached, activeUsers, totalUsers, totalGroups,
    ] = await Promise.all([
      this.incidentRepo.count(),
      this.incidentRepo.count({ where: { status: notDone } }),
      this.incidentRepo.count({ where: { assignedTo: IsNull(), status: notDone } }),
      this.incidentRepo.count({ where: { resolvedAt: MoreThan(start) } }),
      this.incidentRepo.count({ where: { slaBreached: true } }),
      this.userRepo.count({ where: { isActive: true } }),
      this.userRepo.count(),
      this.groupRepo.count(),
    ]);

    // Group by the values actually stored (never a hard-coded list) so the widgets always add up to the tiles.
    const statusRows = await this.incidentRepo.createQueryBuilder("i")
      .select("i.status", "status").addSelect("COUNT(*)", "count").groupBy("i.status").getRawMany();
    const byStatus = statusRows.map((r) => ({ status: String(r.status), count: Number(r.count) }));
    const priorityRows = await this.incidentRepo.createQueryBuilder("i")
      .select("i.priority", "priority").addSelect("COUNT(*)", "count")
      .where("i.status NOT IN (:...done)", { done: ["Resolved", "Closed"] }).groupBy("i.priority").getRawMany();
    const canonPriority = (p: string) => (/^p?1\b|critical/i.test(p) ? "Critical" : /^p?2\b|high/i.test(p) ? "High" : /^p?3\b|medium|moderate/i.test(p) ? "Medium" : /^p?4\b|low/i.test(p) ? "Low" : p);
    const prioMap = new Map<string, number>();
    for (const r of priorityRows) prioMap.set(canonPriority(String(r.priority)), (prioMap.get(canonPriority(String(r.priority))) ?? 0) + Number(r.count));
    const byPriority = ["Critical", "High", "Medium", "Low", ...[...prioMap.keys()].filter((k) => !["Critical", "High", "Medium", "Low"].includes(k))]
      .map((p) => ({ priority: p, count: prioMap.get(p) ?? 0 }));

    const byGroupRaw = await this.incidentRepo
      .createQueryBuilder("i")
      .leftJoin("i.assignmentGroup", "g")
      .select("COALESCE(g.group_name, 'Unassigned')", "groupName")
      .addSelect("COUNT(*)", "count")
      .where("i.status NOT IN (:...done)", { done: ["Resolved", "Closed"] })
      .groupBy("g.group_name")
      .orderBy("COUNT(*)", "DESC")
      .limit(8)
      .getRawMany();

    // Last 7 days: created vs resolved
    const trend: { day: string; created: number; resolved: number }[] = [];
    for (let d = 6; d >= 0; d--) {
      const from = new Date(start); from.setDate(from.getDate() - d);
      const to = new Date(from); to.setDate(to.getDate() + 1);
      trend.push({
        day: from.toISOString().slice(0, 10),
        created: await this.incidentRepo.count({ where: { createdAt: Between(from, to) } }),
        resolved: await this.incidentRepo.count({ where: { resolvedAt: Between(from, to) } }),
      });
    }

    const rated = await this.incidentRepo
      .createQueryBuilder("i")
      .select("AVG(i.feedback_rating)", "avg")
      .addSelect("COUNT(i.feedback_rating)", "n")
      .where("i.feedback_rating IS NOT NULL")
      .getRawOne();

    const recent = await this.incidentRepo.find({
      relations: { assignmentGroup: true, assignedTo: true },
      order: { createdAt: "DESC" },
      take: 8,
    });

    return {
      stats: {
        totalIncidents, openIncidents, unassignedIncidents, resolvedToday,
        slaBreached: breached,
        slaCompliance: totalIncidents ? Math.round(((totalIncidents - breached) / totalIncidents) * 100) : 100,
        activeUsers, totalUsers, totalGroups,
        avgRating: rated?.avg ? Number(Number(rated.avg).toFixed(1)) : null,
        ratingCount: Number(rated?.n ?? 0),
      },
      byStatus,
      byPriority,
      byGroup: byGroupRaw.map((r) => ({ groupName: r.groupName, count: Number(r.count) })),
      trend,
      recent: recent.map((i) => ({
        incidentId: i.incidentId,
        id: i.incidentCode ?? i.incidentId,
        shortDescription: i.title,
        priority: i.priority,
        status: i.status,
        assignmentGroup: i.assignmentGroup?.groupName ?? "—",
        assignedTo: i.assignedTo?.fullName ?? "Unassigned",
        createdAt: i.createdAt,
      })),
    };
  }

  private todayStart(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private timeAgo(date: Date | string): string {
    const ms = Date.now() - new Date(date).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
}
