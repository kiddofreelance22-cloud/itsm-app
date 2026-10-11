import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClosureCode } from "./entities/closure-code.entity";
import { PendingReason } from "./entities/pending-reason.entity";
import { PriorityMatrix } from "./entities/priority-matrix.entity";
import { SlaServiceWindow } from "./entities/sla-service-window.entity";
import { RequestMastersController } from "./request-masters.controller";
import { RequestMastersService } from "./request-masters.service";
@Module({ imports: [TypeOrmModule.forFeature([ClosureCode, PendingReason, PriorityMatrix, SlaServiceWindow])], controllers: [RequestMastersController], providers: [RequestMastersService] })
export class RequestMastersModule {}