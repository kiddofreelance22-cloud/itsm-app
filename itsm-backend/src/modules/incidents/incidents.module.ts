import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Incident } from "./entities/incident.entity";
import { IncidentActivity } from "./entities/incident-activity.entity";
import { Category } from "../categories/entities/category.entity";
import { SubCategory } from "../sub-category/entities/sub-category.entity";
import { User } from "../users/entities/user.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { Location } from "../location/entities/location.entity";
import { ServiceRequest } from "../requests/entities/request.entity";
import { Priority } from "../priority/entities/priority.entity";
import { IncidentsService } from "./incidents.service";
import { IncidentsController } from "./incidents.controller";
import { IncidentsGateway } from "./incidents.gateway";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Incident, IncidentActivity,
      Category, SubCategory, User, AssignmentGroup, Location, ServiceRequest, Priority,
    ]),
  ],
  controllers: [IncidentsController],
  providers: [IncidentsService, IncidentsGateway],
  exports: [IncidentsService],
})
export class IncidentsModule {}
