import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Incident } from "./entities/incident.entity";
import { Category } from "../categories/entities/category.entity";
import { User } from "../users/entities/user.entity";
import { ServiceRequest } from "../requests/entities/request.entity";
import { IncidentsService } from "./incidents.service";
import { IncidentsController } from "./incidents.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([Incident, Category, User, ServiceRequest]),
  ],
  controllers: [IncidentsController],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
