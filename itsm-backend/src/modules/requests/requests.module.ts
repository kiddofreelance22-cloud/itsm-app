import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ServiceRequest } from "./entities/request.entity";
import { RequestVariableValue } from "./entities/request-variable-value.entity";
import { RequestHistory } from "./entities/request-history.entity";
import { Catalog } from "../catalogs/entities/catalog.entity";
import { CatalogVariable } from "../catalogs/entities/catalog-variable.entity";
import { User } from "../users/entities/user.entity";
import { WorkflowsModule } from "../workflows/workflows.module";
import { RolesModule } from "../roles/roles.module";
import { RequestsService } from "./requests.service";
import { RequestsController } from "./requests.controller";
import { ApprovalsService } from "./approvals/approvals.service";
import { ApprovalsController } from "./approvals/approvals.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceRequest,
      RequestVariableValue,
      RequestHistory,
      Catalog,
      CatalogVariable,
      User,
    ]),
    WorkflowsModule,
    RolesModule,
  ],
  controllers: [RequestsController, ApprovalsController],
  providers: [RequestsService, ApprovalsService],
  exports: [RequestsService],
})
export class RequestsModule {}
