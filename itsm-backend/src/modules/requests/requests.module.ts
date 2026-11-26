import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ServiceRequest } from "./entities/request.entity";
import { RequestVariableValue } from "./entities/request-variable-value.entity";
import { RequestHistory } from "./entities/request-history.entity";
import { RequestApproval } from "./entities/request-approval.entity";
import { RequestApprovalVote } from "./entities/request-approval-vote.entity";
import { RequestTask } from "./entities/request-task.entity";
import { Catalog } from "../catalogs/entities/catalog.entity";
import { CatalogVariable } from "../catalogs/entities/catalog-variable.entity";
import { User } from "../users/entities/user.entity";
import { ApprovalLevel } from "../workflows/entities/approval-level.entity";
import { WorkflowTask } from "../workflows/entities/workflow-task.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { ApproverGroup } from "../request-masters/entities/approver-group.entity";
import { ClosureCode } from "../request-masters/entities/closure-code.entity";
import { RequestStatusConfig } from "../request-masters/entities/request-status.entity";
import { RequestNotificationRule } from "../request-masters/entities/request-notification-rule.entity";
import { RequestPriorityMatrix } from "../request-masters/entities/request-priority-matrix.entity";
import { RequestSlaServiceWindow } from "../request-masters/entities/request-sla-service-window.entity";
import { ServiceUrgency } from "../service-urgencies/entities/service-urgency.entity";
import { ServiceImpact } from "../service-impacts/entities/service-impact.entity";
import { ServicePriority } from "../service-priorities/entities/service-priority.entity";
import { RequestPendingReason } from "../request-masters/entities/request-pending-reason.entity";
import { WorkflowsModule } from "../workflows/workflows.module";
import { RolesModule } from "../roles/roles.module";
import { RequestLink } from "./entities/request-link.entity";
import { RequestWorkNote } from "./entities/request-work-note.entity";
import { Incident } from "../incidents/entities/incident.entity";
import { Change } from "../changes/entities/change.entity";
import { Problem } from "../problems/entities/problem.entity";
import { WorkOrder } from "../itsm-config/entities/work-order.entity";
import { IncidentsModule } from "../incidents/incidents.module";
import { ChangesModule } from "../changes/changes.module";
import { ProblemsModule } from "../problems/problems.module";
import { RequestsService } from "./requests.service";
import { RequestLinksService } from "./request-links.service";
import { RequestsController } from "./requests.controller";
import { RequestSlaService } from "./request-sla.service";
import { RequestNotifier } from "./request-notifier.service";
import { RequestSchedulerService } from "./request-scheduler.service";
import { ApprovalsService } from "./approvals/approvals.service";
import { ApprovalsController } from "./approvals/approvals.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceRequest, RequestVariableValue, RequestHistory, RequestApproval, RequestApprovalVote, RequestTask,
      Catalog, CatalogVariable, User, ApprovalLevel, WorkflowTask, AssignmentGroup,
      ApproverGroup, RequestPendingReason, ClosureCode, RequestStatusConfig, RequestNotificationRule,
      RequestPriorityMatrix, RequestSlaServiceWindow, ServiceUrgency, ServiceImpact, ServicePriority,
      RequestLink, RequestWorkNote, Incident, Change, Problem, WorkOrder,
    ]),
    WorkflowsModule,
    RolesModule,
    IncidentsModule,
    ChangesModule,
    ProblemsModule,
  ],
  controllers: [RequestsController, ApprovalsController],
  providers: [RequestsService, RequestLinksService, RequestSlaService, RequestNotifier, RequestSchedulerService, ApprovalsService],
  exports: [RequestsService],
})
export class RequestsModule {}
