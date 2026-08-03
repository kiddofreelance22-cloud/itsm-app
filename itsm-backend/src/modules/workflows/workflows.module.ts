import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Workflow } from "./entities/workflow.entity";
import { WorkflowStep } from "./entities/workflow-step.entity";
import { Role } from "../roles/entities/role.entity";
import { WorkflowsService } from "./workflows.service";
import { WorkflowsController } from "./workflows.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Workflow, WorkflowStep, Role])],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
