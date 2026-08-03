import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
  findAll() {
    return this.workflowsService.findAll();
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
}
