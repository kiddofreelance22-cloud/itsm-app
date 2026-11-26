import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Incident } from "./entities/incident.entity";
import { IncidentTicketLink } from "./entities/incident-ticket-link.entity";
import { IncidentActivity } from "./entities/incident-activity.entity";
import { ServiceRequest } from "../requests/entities/request.entity";
import { Change } from "../changes/entities/change.entity";
import { Problem } from "../problems/entities/problem.entity";
import { WorkOrder } from "../itsm-config/entities/work-order.entity";
import { Category } from "../categories/entities/category.entity";
import { SubCategory } from "../sub-category/entities/sub-category.entity";
import { User } from "../users/entities/user.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { Location } from "../location/entities/location.entity";
import { Priority } from "../priority/entities/priority.entity";
import { CategoriesModule } from "../categories/categories.module";
import { ItsmConfigModule } from "../itsm-config/itsm-config.module";
import { IncidentsService } from "./incidents.service";
import { IncidentsController } from "./incidents.controller";
import { IncidentsGateway } from "./incidents.gateway";
import { IncidentTicketLinksService } from "./incident-ticket-links.service";
import { IncidentRecordController } from "../itsm-config/incident-record.controller";
import { IncidentAttachmentsController } from "../itsm-config/incident-attachments.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Incident, IncidentTicketLink, IncidentActivity,
      Category, SubCategory, User, AssignmentGroup, Location, ServiceRequest, Priority, Change, Problem, WorkOrder,
    ]),
    CategoriesModule,
    ItsmConfigModule,
    AuthModule,
  ],
  controllers: [IncidentsController, IncidentRecordController, IncidentAttachmentsController],
  providers: [IncidentsService, IncidentsGateway, IncidentTicketLinksService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
