import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Workflow } from "./entities/workflow.entity";
import { WorkflowStep } from "./entities/workflow-step.entity";
import { WorkflowTransition } from "./entities/workflow-transition.entity";
import { ApprovalLevel } from "./entities/approval-level.entity";
import { WorkflowTask } from "./entities/workflow-task.entity";
import { Catalog } from "../catalogs/entities/catalog.entity";
import { Role } from "../roles/entities/role.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { KnowledgeArticle } from "../knowledge/entities/knowledge-article.entity";
import { WorkflowsService } from "./workflows.service";
import { WorkflowsController } from "./workflows.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Workflow, WorkflowStep, WorkflowTransition, ApprovalLevel, WorkflowTask, Catalog, Role, AssignmentGroup, KnowledgeArticle])],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
