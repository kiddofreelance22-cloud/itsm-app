import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Incident } from "../incidents/entities/incident.entity";
import { ServiceRequest } from "../requests/entities/request.entity";
import { User } from "../users/entities/user.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { Task } from "../tasks/entities/task.entity";
import { Problem } from "../problems/entities/problem.entity";
import { Change } from "../changes/entities/change.entity";
import { DashboardService } from "./dashboard.service";
import { DashboardController } from "./dashboard.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Incident, ServiceRequest, User, AssignmentGroup, Task, Problem, Change])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
