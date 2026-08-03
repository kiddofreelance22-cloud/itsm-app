import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Workflow } from "./entities/workflow.entity";
import { WorkflowStep } from "./entities/workflow-step.entity";
import { Role } from "../roles/entities/role.entity";
import { CreateWorkflowDto } from "./dto/create-workflow.dto";
import { UpdateWorkflowDto } from "./dto/update-workflow.dto";

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(Workflow) private workflowsRepo: Repository<Workflow>,
    @InjectRepository(WorkflowStep)
    private stepsRepo: Repository<WorkflowStep>,
    @InjectRepository(Role) private rolesRepo: Repository<Role>
  ) {}

  async create(dto: CreateWorkflowDto): Promise<Workflow> {
    const workflow = this.workflowsRepo.create({
      workflowName: dto.workflowName,
      description: dto.description,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.workflowsRepo.save(workflow);

    if (dto.steps?.length) {
      for (const stepDto of dto.steps) {
        await this.addStep(saved.workflowId, stepDto);
      }
    }

    return this.findOne(saved.workflowId);
  }

  findAll(): Promise<Workflow[]> {
    return this.workflowsRepo.find({
      relations: { steps: { approverRole: true } },
      order: { workflowId: "ASC" },
    });
  }

  async findOne(workflowId: number): Promise<Workflow> {
    const workflow = await this.workflowsRepo.findOne({
      where: { workflowId },
      relations: { steps: { approverRole: true } },
      order: { steps: { stepOrder: "ASC" } },
    });
    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }
    return workflow;
  }

  async update(workflowId: number, dto: UpdateWorkflowDto): Promise<Workflow> {
    const workflow = await this.findOne(workflowId);
    Object.assign(workflow, dto);
    await this.workflowsRepo.save(workflow);
    return this.findOne(workflowId);
  }

  async remove(workflowId: number): Promise<void> {
    const workflow = await this.findOne(workflowId);
    await this.workflowsRepo.remove(workflow);
  }

  // ---- steps sub-resource ----

  async addStep(
    workflowId: number,
    dto: { stepName: string; stepOrder: number; stepType: string; approverRoleId?: number }
  ): Promise<WorkflowStep> {
    const workflow = await this.workflowsRepo.findOne({
      where: { workflowId },
    });
    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }

    let approverRole: Role | null = null;
    if (dto.approverRoleId) {
      approverRole = await this.rolesRepo.findOne({
        where: { roleId: dto.approverRoleId },
      });
      if (!approverRole) {
        throw new NotFoundException(`Role ${dto.approverRoleId} not found`);
      }
    }

    const step = this.stepsRepo.create({
      workflow,
      stepName: dto.stepName,
      stepOrder: dto.stepOrder,
      stepType: dto.stepType as any,
      approverRole,
    });
    return this.stepsRepo.save(step);
  }

  async removeStep(workflowId: number, workflowStepId: number): Promise<void> {
    const step = await this.stepsRepo.findOne({
      where: { workflowStepId, workflow: { workflowId } },
    });
    if (!step) {
      throw new NotFoundException(
        `Step ${workflowStepId} not found on workflow ${workflowId}`
      );
    }
    await this.stepsRepo.remove(step);
  }

  /** Used by RequestsService to advance a request through the workflow. */
  async getFirstStep(workflowId: number): Promise<WorkflowStep | null> {
    return this.stepsRepo.findOne({
      where: { workflow: { workflowId } },
      order: { stepOrder: "ASC" },
      relations: { approverRole: true },
    });
  }

  async getNextStep(
    workflowId: number,
    currentStepOrder: number
  ): Promise<WorkflowStep | null> {
    const steps = await this.stepsRepo.find({
      where: { workflow: { workflowId } },
      order: { stepOrder: "ASC" },
      relations: { approverRole: true },
    });
    return steps.find((s) => s.stepOrder > currentStepOrder) ?? null;
  }
}
