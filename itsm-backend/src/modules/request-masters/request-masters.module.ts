import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClosureCode } from "./entities/closure-code.entity";
import { PendingReason } from "./entities/pending-reason.entity";
import { RequestPendingReason } from "./entities/request-pending-reason.entity";
import { RequestPendingReasonsController } from "./request-pending-reasons.controller";
import { RequestPendingReasonsService } from "./request-pending-reasons.service";
import { PriorityMatrix } from "./entities/priority-matrix.entity";
import { SlaServiceWindow } from "./entities/sla-service-window.entity";
import { RequestSlaServiceWindow } from "./entities/request-sla-service-window.entity";
import { RequestSlaServiceWindowsController } from "./request-sla-service-windows.controller";
import { RequestSlaServiceWindowsService } from "./request-sla-service-windows.service";
import { RequestMastersController } from "./request-masters.controller";
import { RequestMastersService } from "./request-masters.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClosureCode,
      PendingReason,
      RequestPendingReason,
      PriorityMatrix,
      SlaServiceWindow,
      RequestSlaServiceWindow,
    ]),
  ],
  controllers: [
    RequestMastersController,
    RequestPendingReasonsController,
    RequestSlaServiceWindowsController,
  ],
  providers: [
    RequestMastersService,
    RequestPendingReasonsService,
    RequestSlaServiceWindowsService,
  ],
  exports: [
    RequestMastersService,
    RequestPendingReasonsService,
    RequestSlaServiceWindowsService,
    TypeOrmModule,
  ],
})
export class RequestMastersModule {}