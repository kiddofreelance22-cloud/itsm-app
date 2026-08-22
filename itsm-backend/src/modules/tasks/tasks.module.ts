import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Task } from "./entities/task.entity";
import { User } from "../users/entities/user.entity";
import { Incident } from "../incidents/entities/incident.entity";
import { IncidentActivity } from "../incidents/entities/incident-activity.entity";
import { TasksService } from "./tasks.service";
import { TasksController } from "./tasks.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Task, User, Incident, IncidentActivity])],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
