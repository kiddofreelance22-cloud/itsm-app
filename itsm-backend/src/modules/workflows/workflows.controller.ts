import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { WorkflowsService } from "./workflows.service";
import { CreateWorkflowDto } from "./dto/create-workflow.dto";
import { UpdateWorkflowDto } from "./dto/update-workflow.dto";
import { CreateWorkflowStepDto } from "./dto/create-workflow-step.dto";
import { UpdateWorkflowStepDto } from "./dto/update-workflow-step.dto";
import { UpdateWorkflowTransitionsDto } from "./dto/update-workflow-transitions.dto";
import { ReplaceWorkflowStepApprovalLevelsDto } from "./dto/workflow-step-approval-level.dto";
import { ReplaceWorkflowStepTasksDto } from "./dto/workflow-step-tasks.dto";

@ApiTags("workflows")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("workflows")
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post()
  @Roles("Admin")
  create(@Body() dto: CreateWorkflowDto) {
    return this.workflowsService.create(dto);
  }

  @Get()
  @Roles("Admin")
  findAll(@Query("scope") scope?: "service_request" | "knowledge") {
    return this.workflowsService.findAll(scope);
  }

  @Get("activity-definitions")
  @Roles("Admin")
  getActivityDefinitions() {
    return this.workflowsService.getActivityDefinitions();
  }

  /** Which catalog items use each lifecycle (for the Used by column and delete protection). */
  @Get("usage")
  @Roles("Admin")
  usage() {
    return this.workflowsService.usage();
  }

  @Get(":workflowId")
  @Roles("Admin")
  findOne(@Param("workflowId", ParseIntPipe) workflowId: number) {
    return this.workflowsService.findOne(workflowId);
  }

  @Patch(":workflowId")
  @Roles("Admin")
  update(
    @Param("workflowId", ParseIntPipe) workflowId: number,
    @Body() dto: UpdateWorkflowDto
  ) {
    return this.workflowsService.update(workflowId, dto);
  }

  @Delete(":workflowId")
  @Roles("Admin")
  remove(@Param("workflowId", ParseIntPipe) workflowId: number) {
    return this.workflowsService.remove(workflowId);
  }

  @Post(":workflowId/steps")
  @Roles("Admin")
  addStep(
    @Param("workflowId", ParseIntPipe) workflowId: number,
    @Body() dto: CreateWorkflowStepDto
  ) {
    return this.workflowsService.addStep(workflowId, dto);
  }

  @Delete(":workflowId/steps/:workflowStepId")
  @Roles("Admin")
  removeStep(
    @Param("workflowId", ParseIntPipe) workflowId: number,
    @Param("workflowStepId", ParseIntPipe) workflowStepId: number
  ) {
    return this.workflowsService.removeStep(workflowId, workflowStepId);
  }

  @Patch(":workflowId/steps/:workflowStepId")
  @Roles("Admin")
  updateStep(
    @Param("workflowId", ParseIntPipe) workflowId: number,
    @Param("workflowStepId", ParseIntPipe) workflowStepId: number,
    @Body() dto: UpdateWorkflowStepDto
  ) {
    return this.workflowsService.updateStep(workflowId, workflowStepId, dto);
  }

  @Get(":workflowId/steps/:workflowStepId/approval-levels")
  @Roles("Admin")
  getApprovalLevels(
    @Param("workflowId", ParseIntPipe) workflowId: number,
    @Param("workflowStepId", ParseIntPipe) workflowStepId: number
  ) {
    return this.workflowsService.getApprovalLevels(workflowId, workflowStepId);
  }

  @Put(":workflowId/steps/:workflowStepId/approval-levels")
  @Roles("Admin")
  replaceApprovalLevels(
    @Param("workflowId", ParseIntPipe) workflowId: number,
    @Param("workflowStepId", ParseIntPipe) workflowStepId: number,
    @Body() dto: ReplaceWorkflowStepApprovalLevelsDto
  ) {
    return this.workflowsService.replaceApprovalLevels(workflowId, workflowStepId, dto.levels);
  }

  @Get(":workflowId/steps/:workflowStepId/tasks")
  @Roles("Admin")
  getTasks(
    @Param("workflowId", ParseIntPipe) workflowId: number,
    @Param("workflowStepId", ParseIntPipe) workflowStepId: number
  ) {
    return this.workflowsService.getTasks(workflowId, workflowStepId);
  }

  @Put(":workflowId/steps/:workflowStepId/tasks")
  @Roles("Admin")
  replaceTasks(
    @Param("workflowId", ParseIntPipe) workflowId: number,
    @Param("workflowStepId", ParseIntPipe) workflowStepId: number,
    @Body() dto: ReplaceWorkflowStepTasksDto
  ) {
    return this.workflowsService.replaceTasks(workflowId, workflowStepId, dto.tasks);
  }

  @Patch(":workflowId/steps/:workflowStepId/reorder")
  @Roles("Admin")
  reorderStep(
    @Param("workflowId", ParseIntPipe) workflowId: number,
    @Param("workflowStepId", ParseIntPipe) workflowStepId: number,
    @Body() dto: { newOrder: number }
  ) {
    return this.workflowsService.reorderStep(workflowId, workflowStepId, dto.newOrder);
  }

  @Patch(":workflowId/steps/:workflowStepId/transitions")
  @Roles("Admin")
  updateTransitions(
    @Param("workflowId", ParseIntPipe) workflowId: number,
    @Param("workflowStepId", ParseIntPipe) workflowStepId: number,
    @Body() dto: UpdateWorkflowTransitionsDto
  ) {
    return this.workflowsService.updateTransitions(workflowId, workflowStepId, dto);
  }
}
