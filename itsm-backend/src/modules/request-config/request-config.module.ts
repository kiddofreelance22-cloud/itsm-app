import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RequestStatusConfig } from "../request-masters/entities/request-status.entity";
import { ApproverGroup } from "../request-masters/entities/approver-group.entity";
import { RequestPriorityMatrix } from "../request-masters/entities/request-priority-matrix.entity";
import { RequestNotificationRule } from "../request-masters/entities/request-notification-rule.entity";
import { User } from "../users/entities/user.entity";
import { ServiceRequest } from "../requests/entities/request.entity";
import { RequestConfigService } from "./request-config.service";
import {
  RequestStatusesController, ApproverGroupsController, RequestPriorityMatrixController, RequestNotificationRulesController,
} from "./request-config.controller";

/** Configuration screens for the Service Request module. */
@Module({
  imports: [TypeOrmModule.forFeature([RequestStatusConfig, ApproverGroup, RequestPriorityMatrix, RequestNotificationRule, User, ServiceRequest])],
  controllers: [RequestStatusesController, ApproverGroupsController, RequestPriorityMatrixController, RequestNotificationRulesController],
  providers: [RequestConfigService],
})
export class RequestConfigModule {}
