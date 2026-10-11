import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AssignmentGroup } from "./entities/assignment-group.entity";
import { User } from "../users/entities/user.entity";
import { Incident } from "../incidents/entities/incident.entity";
import { AssignmentGroupService } from "./assignment-group.service";
import { AssignmentGroupController } from "./assignment-group.controller";

@Module({
  imports: [TypeOrmModule.forFeature([AssignmentGroup, User, Incident])],
  controllers: [AssignmentGroupController],
  providers: [AssignmentGroupService],
  exports: [AssignmentGroupService],
})
export class AssignmentGroupModule {}
