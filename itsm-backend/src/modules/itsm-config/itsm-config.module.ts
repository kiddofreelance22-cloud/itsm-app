import { IncidentActivity } from "../incidents/entities/incident-activity.entity";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IncidentChecklist } from "./entities/incident-checklist.entity";
import { WoChecklistItem } from "./entities/wo-checklist-item.entity";
import { OnHoldReason } from "./entities/on-hold-reason.entity";
import { ResolutionCode } from "./entities/resolution-code.entity";
import { Classification } from "./entities/classification.entity";
import { StatusTransition } from "./entities/status-transition.entity";
import { MandatoryFieldRule } from "./entities/mandatory-field-rule.entity";
import { ApprovalRule } from "./entities/approval-rule.entity";
import { IncidentApproval } from "./entities/incident-approval.entity";
import { NotificationRule } from "./entities/notification-rule.entity";
import { WorkOrder } from "./entities/work-order.entity";
import { SlaMatrixEntry } from "./entities/sla-matrix.entity";
import { WorkgroupSlaWindow } from "./entities/workgroup-sla-window.entity";
import { DirectorySource } from "./entities/directory-source.entity";
import { DirectoryAttributeMapping } from "./entities/directory-attribute-mapping.entity";
import { DirectorySyncRun } from "./entities/directory-sync-run.entity";
import { Incident } from "../incidents/entities/incident.entity";
import { User } from "../users/entities/user.entity";
import { Role } from "../roles/entities/role.entity";
import { UserRole } from "../roles/entities/user-role.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { Status } from "../status/entities/status.entity";
import { Priority } from "../priority/entities/priority.entity";
import { Category } from "../categories/entities/category.entity";
import { Urgency } from "../urgency/entities/urgency.entity";
import { Impact } from "../impact/entities/impact.entity";
import { PendingReason } from "../request-masters/entities/pending-reason.entity";
import { PriorityMatrix } from "../request-masters/entities/priority-matrix.entity";
import { SlaServiceWindow } from "../request-masters/entities/sla-service-window.entity";
import { IncidentChecklistProgress, IncidentLink, RoleNavigationAccess, LogIncidentField, IncidentAttachment } from "./entities/incident-record.entities";
import { RequestLink } from "../requests/entities/request-link.entity";
import { NavigationAccessController } from "./incident-record.controller";
import { WorkOrder as _WorkOrderRef } from "./entities/work-order.entity";
import { RuleEngineService } from "./rule-engine.service";
import { NotificationService } from "./notification.service";
import { DirectoryService } from "./directory.service";
import { DirectoryScheduler } from "./directory.scheduler";
import { DirectoryController } from "./directory.controller";
import { ChecklistsController, OnHoldReasonsController, ResolutionCodesController, WoChecklistItemsController } from "./masters.controller";
import {
  ApprovalRulesController, ClassificationsController, MandatoryFieldRulesController, NotificationRulesController,
  RuleOptionsController, StatusTransitionsController, LogIncidentFieldsController,
} from "./config-rules.controller";
import { FeedbackModerationController, IncidentApprovalsController, WorkOrdersController } from "./operations.controller";
import { SlaMatrixController, WorkgroupSlaWindowsController } from "./sla.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IncidentChecklist, WoChecklistItem, OnHoldReason, ResolutionCode, Classification, StatusTransition,
      MandatoryFieldRule, ApprovalRule, IncidentApproval, NotificationRule, WorkOrder, SlaMatrixEntry,
      WorkgroupSlaWindow, DirectorySource, DirectoryAttributeMapping, DirectorySyncRun,
      Incident, User, Role, UserRole, AssignmentGroup, Status, Priority, Category, Urgency, Impact,
      PendingReason, PriorityMatrix, SlaServiceWindow, IncidentChecklistProgress, IncidentLink, RoleNavigationAccess, LogIncidentField, IncidentAttachment,
      RequestLink, IncidentActivity,
    ]),
  ],
  controllers: [
    ChecklistsController, WoChecklistItemsController, OnHoldReasonsController, ResolutionCodesController,
    ClassificationsController, StatusTransitionsController, MandatoryFieldRulesController, ApprovalRulesController,
    RuleOptionsController, LogIncidentFieldsController, NotificationRulesController, IncidentApprovalsController, FeedbackModerationController,
    WorkOrdersController, SlaMatrixController, WorkgroupSlaWindowsController, DirectoryController, NavigationAccessController,
  ],
  providers: [RuleEngineService, NotificationService, DirectoryService, DirectoryScheduler],
  exports: [RuleEngineService, NotificationService, DirectoryService, TypeOrmModule],
})
export class ItsmConfigModule {}
