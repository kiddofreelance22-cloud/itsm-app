import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, IsNull, Not, In } from "typeorm";
import { Incident } from "../incidents/entities/incident.entity";
import { ServiceRequest } from "../requests/entities/request.entity";
import { User } from "../users/entities/user.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { Task } from "../tasks/entities/task.entity";
import { Problem } from "../problems/entities/problem.entity";
import { Change } from "../changes/entities/change.entity";

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
  ) {}

  async getAnalystStats(userId: number, from?: Date, to?: Date) {
    const dateFilter = from && to ? Between(from, to) : undefined;
    const baseWhere = dateFilter ? { createdAt: dateFilter } : {};

    // Incident counts
    const [
      totalIncidents,
      openIncidents,
      inProgressIncidents,
      resolvedToday,
      myIncidents,
      myOpenIncidentsCount,
      myInProgressIncidentsCount,
      myResolvedTodayCount,
    ] = await Promise.all([
      this.incidentRepo.count({ where: { ...baseWhere } }),
      this.incidentRepo.count({ where: { ...baseWhere, status: "Open" } }),
      this.incidentRepo.count({ where: { ...baseWhere, status: "In Progress" } }),
      this.incidentRepo.count({ where: { status: "Resolved", resolvedAt: Between(this.todayStart(), new Date()) } }),
      this.incidentRepo.count({ where: { assignedTo: { userId } } }),
      // These are the "actionable to me" figures — what the engineer can actually
      // click through to on this same dashboard, so the headline number on the
      // Incidents card always matches something real in their own queue.
      this.incidentRepo.count({ where: { assignedTo: { userId }, status: "Open" } }),
      this.incidentRepo.count({ where: { assignedTo: { userId }, status: "In Progress" } }),
      this.incidentRepo.count({ where: { assignedTo: { userId }, status: "Resolved", resolvedAt: Between(this.todayStart(), new Date()) } }),
    ]);

    // Service Request counts
    const [totalRequests, openRequests, inProgressRequests, completedToday] = await Promise.all([
      this.requestRepo.count({ where: { ...baseWhere } }),
      this.requestRepo.count({ where: { ...baseWhere, status: "Submitted" } }),
      this.requestRepo.count({ where: { ...baseWhere, status: "In Progress" } }),
      this.requestRepo.count({ where: { status: "Approved" } }),
    ]);

    // Problem counts
    const [totalProblems, openProblems, inProgressProblems, problemsResolvedToday] = await Promise.all([
      this.problemRepo.count({ where: { ...baseWhere } }),
      this.problemRepo.count({ where: { ...baseWhere, status: "Open" } }),
      this.problemRepo.count({ where: { ...baseWhere, status: "In Progress" } }),
      this.problemRepo.count({ where: { resolvedAt: Between(this.todayStart(), new Date()) } }),
    ]);

    // Change counts
    const [totalChanges, openChanges, inProgressChanges, changesCompletedToday] = await Promise.all([
      this.changeRepo.count({ where: { ...baseWhere } }),
      this.changeRepo.count({ where: { ...baseWhere, status: "Open" } }),
      this.changeRepo.count({ where: { ...baseWhere, status: "In Progress" } }),
      this.changeRepo.count({ where: { completedAt: Between(this.todayStart(), new Date()) } }),
    ]);

    // Task counts
    const [totalTasks, openTasks, overdueTasks] = await Promise.all([
      this.taskRepo.count({ where: { ...baseWhere } }),
      this.taskRepo.count({ where: { ...baseWhere, status: "Open" } }),
      this.taskRepo
        .createQueryBuilder("task")
        .where("task.due_date IS NOT NULL")
        .andWhere("task.due_date < :now", { now: new Date() })
        .andWhere("task.status NOT IN (:...done)", { done: ["Completed", "Cancelled"] })
        .getCount(),
    ]);

    // Approval counts. A request's status is "In Progress" while it's sitting on a
    // workflow step awaiting an approver, and flips to "Approved" once the workflow
    // finishes — see RequestsService.advanceWorkflow.
    const [pendingApprovals, approvedApprovals] = await Promise.all([
      this.requestRepo.count({ where: { status: "In Progress" } }),
      this.requestRepo.count({ where: { status: "Approved" } }),
    ]);

    // SLA stats
    const slaBreached = await this.incidentRepo.count({ where: { slaBreached: true } });
    const slaTotal = await this.incidentRepo.count();
    const slaMet = await this.incidentRepo.count({ where: { slaResponseMet: true } });
    const slaAtRisk = Math.max(0, slaTotal - slaMet - slaBreached);

    // Unassigned by group
    const groups = await this.groupRepo.find({ relations: { members: true } });
    const unassignedByGroup = await Promise.all(
      groups.map(async (g) => ({
        groupId: g.groupId,
        groupName: g.groupName,
        incidentCount: await this.incidentRepo.count({
          where: { assignmentGroup: { groupId: g.groupId }, assignedTo: IsNull() },
        }),
        requestCount: 0,
      }))
    );

    // Priority distribution
    const priorities = ["Low", "Medium", "High", "Critical"] as const;
    const byPriority = await Promise.all(
      priorities.map(async (p) => ({
        priority: p,
        count: await this.incidentRepo.count({ where: { priority: p } }),
      }))
    );

    // Status distribution
    const statuses = ["Open", "Assigned", "In Progress", "On Hold", "Resolved", "Closed"] as const;
    const byStatus = await Promise.all(
      statuses.map(async (s) => ({
        status: s,
        count: await this.incidentRepo.count({ where: { status: s as any } }),
      }))
    );

    // My open incidents (assigned to me, OR unassigned in my groups)
    const userGroupIds = groups
      .filter((g) => g.members?.some((m) => m.userId === userId))
      .map((g) => g.groupId);

    const myOpenIncidentsWhere: any[] = [
      { assignedTo: { userId }, status: Not("Closed") },
    ];
    if (userGroupIds.length > 0) {
      myOpenIncidentsWhere.push({
        assignmentGroup: { groupId: In(userGroupIds) },
        assignedTo: IsNull(),
        status: Not("Closed"),
      });
    }

    const myOpenIncidents = await this.incidentRepo.find({
      where: myOpenIncidentsWhere,
      relations: { category: true, assignmentGroup: true },
      order: { createdAt: "DESC" },
      take: 5,
    });

    // My open service requests
    const myOpenRequests = await this.requestRepo.find({
      where: { requestedBy: { userId } },
      relations: { catalog: true },
      order: { createdAt: "DESC" },
      take: 5,
    });

    // Unassigned tickets total
    const unassignedTotal = await this.incidentRepo.count({ where: { assignedTo: IsNull() } });
    const unassignedIncidents = await this.incidentRepo.count({ where: { assignedTo: IsNull() } });

    return {
      incidents: {
        total: totalIncidents,
        open: openIncidents,
        inProgress: inProgressIncidents,
        resolvedToday,
        mine: myIncidents,
        mineOpen: myOpenIncidentsCount,
        mineInProgress: myInProgressIncidentsCount,
        mineResolvedToday: myResolvedTodayCount,
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
        total: unassignedTotal,
        incidents: unassignedIncidents,
        serviceRequests: 0,
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
        id: `SRQ${String(r.requestId).padStart(9, "0")}`,
        summary: r.catalog?.catalogName ?? "—",
        priority: "Medium",
        status: r.status,
        assignmentGroup: "—",
        updatedAgo: this.timeAgo(new Date(r.createdAt)),
      })),
      unassignedByGroup: unassignedByGroup.filter((g) => g.incidentCount > 0 || g.requestCount > 0),
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
