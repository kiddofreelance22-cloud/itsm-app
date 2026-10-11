import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Workflow } from "./entities/workflow.entity";
import { WorkflowStep } from "./entities/workflow-step.entity";
import { WorkflowTransition } from "./entities/workflow-transition.entity";
import { ApprovalLevel } from "./entities/approval-level.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { Role } from "../roles/entities/role.entity";
import { CreateWorkflowDto } from "./dto/create-workflow.dto";
import { UpdateWorkflowDto } from "./dto/update-workflow.dto";
import { UpdateWorkflowTransitionsDto } from "./dto/update-workflow-transitions.dto";
import { WorkflowStepApprovalLevelDto } from "./dto/workflow-step-approval-level.dto";

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(Workflow) private workflowsRepo: Repository<Workflow>,
    @InjectRepository(WorkflowStep)
    private stepsRepo: Repository<WorkflowStep>,
    @InjectRepository(WorkflowTransition)
    private transitionsRepo: Repository<WorkflowTransition>,
    @InjectRepository(ApprovalLevel)
    private approvalLevelsRepo: Repository<ApprovalLevel>,
    @InjectRepository(Role) private rolesRepo: Repository<Role>
    ,@InjectRepository(AssignmentGroup) private assignmentGroupsRepo: Repository<AssignmentGroup>
  ) {}

  getActivityDefinitions() {
    return [
      { type: "approval", label: "Approval", group: "Approval level" },
      { type: "task", label: "Task", group: "Approval level" },
      { type: "notification", label: "Notification", group: "Notification" },
      { type: "condition", label: "Condition", group: "Condition" },
      { type: "wait", label: "Wait / Timer", group: "Condition" },
      { type: "subflow", label: "Subflow", group: "Condition" },
      { type: "update", label: "Update Fields", group: "Condition" },
    ];
  }

  async create(dto: CreateWorkflowDto): Promise<Workflow> {
    let approverRole: Role | undefined;
    if (dto.approverRoleId) {
      approverRole = await this.rolesRepo.findOne({ where: { roleId: dto.approverRoleId } }) ?? undefined;
      if (!approverRole) {
        throw new NotFoundException(`Role ${dto.approverRoleId} not found`);
      }
    }

    const workflow = this.workflowsRepo.create({
      workflowName: dto.workflowName,
      description: dto.description,
      isActive: dto.isActive ?? true,
      requiresApproval: dto.requiresApproval ?? false,
      approverRole,
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
      relations: { steps: { approverRole: true, approvalLevels: { customGroup: true } }, transitions: { fromStep: true, toStep: true }, approverRole: true },
      order: { workflowId: "ASC", steps: { stepOrder: "ASC" } },
    });
  }

  async findOne(workflowId: number): Promise<Workflow> {
    const workflow = await this.workflowsRepo.findOne({
      where: { workflowId },
      relations: { steps: { approverRole: true, approvalLevels: { customGroup: true } }, transitions: { fromStep: true, toStep: true }, approverRole: true },
      order: { steps: { stepOrder: "ASC" } },
    });
    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }
    return workflow;
  }

  async update(workflowId: number, dto: UpdateWorkflowDto): Promise<Workflow> {
    const workflow = await this.findOne(workflowId);
    const { approverRoleId, ...rest } = dto as UpdateWorkflowDto & { approverRoleId?: number | null };
    Object.assign(workflow, rest);
    if (approverRoleId !== undefined) {
      workflow.approverRole = approverRoleId === null
        ? undefined
        : (await this.rolesRepo.findOne({ where: { roleId: approverRoleId } })) ?? undefined;
    }
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
    dto: {
      stepName: string;
      stepOrder: number;
      stepType: string;
      approverRoleId?: number;
      nodeKind?: string;
      config?: Record<string, unknown>;
      positionX?: number;
      positionY?: number;
      approvalLevels?: WorkflowStepApprovalLevelDto[];
    }
  ): Promise<WorkflowStep> {
    const workflow = await this.workflowsRepo.findOne({
      where: { workflowId },
    });
    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }

    let approverRole: Role | undefined;
    if (dto.approverRoleId) {
      approverRole = await this.rolesRepo.findOne({
        where: { roleId: dto.approverRoleId },
      }) ?? undefined;
      if (!approverRole) {
        throw new NotFoundException(`Role ${dto.approverRoleId} not found`);
      }
    }

    // Shift existing steps to make room for the new step
    const existingSteps = await this.stepsRepo.find({
      where: { workflow: { workflowId } },
      order: { stepOrder: "DESC" }, // Start from highest order to avoid conflicts
    });

    // Update step orders for steps that come after the insertion point
    for (const step of existingSteps) {
      if (step.stepOrder >= dto.stepOrder) {
        step.stepOrder += 1;
        await this.stepsRepo.save(step);
      }
    }

    // Create the new step with the exact order requested
    const step = this.stepsRepo.create({
      workflow,
      stepName: dto.stepName,
      stepOrder: dto.stepOrder,
      stepType: dto.stepType as any,
      nodeKind: dto.nodeKind,
      config: dto.config,
      positionX: dto.positionX,
      positionY: dto.positionY,
    });
    if (approverRole) step.approverRole = approverRole;
    
    const savedStep = await this.stepsRepo.save(step);
    
    // Verify the step was created with the correct order
    const verificationStep = await this.stepsRepo.findOne({
      where: { workflowStepId: savedStep.workflowStepId },
    });
    
    const persistedStep = verificationStep || savedStep;
    if (dto.approvalLevels) {
      await this.replaceApprovalLevelsForStep(persistedStep, dto.approvalLevels);
    }
    return persistedStep;
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

  async updateStep(
    workflowId: number,
    workflowStepId: number,
    dto: {
      stepName?: string;
      conditionExpression?: string;
      approverRoleId?: number | null;
      nodeKind?: string;
      config?: Record<string, unknown>;
      positionX?: number;
      positionY?: number;
      approvalLevels?: WorkflowStepApprovalLevelDto[];
    }
  ): Promise<WorkflowStep> {
    const step = await this.stepsRepo.findOne({
      where: { workflowStepId, workflow: { workflowId } },
    });
    if (!step) {
      throw new NotFoundException(
        `Step ${workflowStepId} not found on workflow ${workflowId}`
      );
    }
    if (dto.stepName !== undefined) {
      step.stepName = dto.stepName;
    }
    if (dto.conditionExpression !== undefined) {
      step.conditionExpression = dto.conditionExpression || undefined;
    }
    if (dto.approverRoleId !== undefined) {
      step.approverRole = dto.approverRoleId === null
        ? undefined
        : await this.rolesRepo.findOne({ where: { roleId: dto.approverRoleId } }) || undefined;
    }
    if (dto.nodeKind !== undefined) {
      step.nodeKind = dto.nodeKind;
    }
    if (dto.config !== undefined) {
      step.config = dto.config;
    }
    if (dto.positionX !== undefined) {
      step.positionX = dto.positionX;
    }
    if (dto.positionY !== undefined) {
      step.positionY = dto.positionY;
    }
    const savedStep = await this.stepsRepo.save(step);
    if (dto.approvalLevels) {
      await this.replaceApprovalLevelsForStep(savedStep, dto.approvalLevels);
    }
    return savedStep;
  }

  async getApprovalLevels(workflowId: number, workflowStepId: number): Promise<ApprovalLevel[]> {
    const step = await this.stepsRepo.findOne({ where: { workflowStepId, workflow: { workflowId } } });
    if (!step) throw new NotFoundException(`Step ${workflowStepId} not found on workflow ${workflowId}`);
    return this.approvalLevelsRepo.find({
      where: { activity: { workflowStepId } },
      relations: { customGroup: true },
      order: { levelNumber: "ASC" },
    });
  }

  async replaceApprovalLevels(
    workflowId: number,
    workflowStepId: number,
    levels: WorkflowStepApprovalLevelDto[]
  ): Promise<ApprovalLevel[]> {
    const step = await this.stepsRepo.findOne({ where: { workflowStepId, workflow: { workflowId } } });
    if (!step) throw new NotFoundException(`Step ${workflowStepId} not found on workflow ${workflowId}`);
    return this.replaceApprovalLevelsForStep(step, levels);
  }

  private async replaceApprovalLevelsForStep(
    step: WorkflowStep,
    inputs: WorkflowStepApprovalLevelDto[]
  ): Promise<ApprovalLevel[]> {
    const existing = await this.approvalLevelsRepo.find({
      where: { activity: { workflowStepId: step.workflowStepId } },
      relations: { customGroup: true },
    });
    const existingById = new Map(existing.map((level) => [level.approvalLevelId, level]));
    const groupIds = [...new Set(inputs.map((level) => level.customGroupId).filter((id): id is number => id !== undefined))];
    const groups = groupIds.length
      ? await this.assignmentGroupsRepo.find({ where: { groupId: In(groupIds) } })
      : [];
    const groupsById = new Map(groups.map((group) => [group.groupId, group]));

    const saved: ApprovalLevel[] = [];
    for (const [index, input] of inputs.entries()) {
      const level = input.approvalLevelId
        ? existingById.get(input.approvalLevelId)
        : this.approvalLevelsRepo.create();
      if (!level) throw new NotFoundException(`Approval level ${input.approvalLevelId} not found on this step`);
      if (input.customGroupId && !groupsById.has(input.customGroupId)) {
        throw new NotFoundException(`Assignment group ${input.customGroupId} not found`);
      }
      level.activity = step;
      level.levelNumber = index + 1;
      level.title = input.title;
      level.approverType = input.approverType;
      level.approverId = input.approverId;
      level.autoApproval = input.autoApproval ?? false;
      level.emailNotificationsForEndUser = input.emailNotificationsForEndUser ?? false;
      level.referBackToRequestor = input.referBackToRequestor ?? false;
      level.referBackToPreviousApprovers = input.referBackToPreviousApprovers ?? false;
      level.customGroup = input.customGroupId ? groupsById.get(input.customGroupId) : undefined;
      saved.push(level);
    }

    if (saved.length) await this.approvalLevelsRepo.save(saved);
    const savedIds = new Set(saved.map((level) => level.approvalLevelId));
    const removed = existing.filter((level) => !savedIds.has(level.approvalLevelId));
    if (removed.length) await this.approvalLevelsRepo.remove(removed);

    return this.approvalLevelsRepo.find({
      where: { activity: { workflowStepId: step.workflowStepId } },
      relations: { customGroup: true },
      order: { levelNumber: "ASC" },
    });
  }

  async updateTransitions(
    workflowId: number,
    fromStepId: number,
    dto: UpdateWorkflowTransitionsDto
  ): Promise<Workflow> {
    const workflow = await this.workflowsRepo.findOne({ where: { workflowId } });
    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);

    const fromStep = await this.stepsRepo.findOne({
      where: { workflowStepId: fromStepId, workflow: { workflowId } },
    });
    if (!fromStep) throw new NotFoundException(`Step ${fromStepId} not found on workflow ${workflowId}`);
    const branches = new Set<string>();
    for (const input of dto.transitions) {
      if (branches.has(input.branch)) throw new NotFoundException(`Duplicate ${input.branch} transition`);
      branches.add(input.branch);
      if (input.targetStepId > 0) {
        const target = await this.stepsRepo.findOne({
          where: { workflowStepId: input.targetStepId, workflow: { workflowId } },
        });
        if (!target) throw new NotFoundException(`Target step ${input.targetStepId} not found on workflow ${workflowId}`);
        if (target.workflowStepId === fromStepId) throw new NotFoundException("A step cannot transition to itself");
      }
    }

    await this.transitionsRepo.delete({ workflow: { workflowId }, fromStep: { workflowStepId: fromStepId } });
    for (const input of dto.transitions) {
      const target = input.targetStepId > 0
        ? await this.stepsRepo.findOneOrFail({ where: { workflowStepId: input.targetStepId } })
        : null;
      await this.transitionsRepo.save(this.transitionsRepo.create({
        workflow,
        fromStep,
        toStep: target,
        branch: input.branch,
      }));
    }
    return this.findOne(workflowId);
  }

  async reorderStep(workflowId: number, workflowStepId: number, newOrder: number): Promise<WorkflowStep> {
    const step = await this.stepsRepo.findOne({
      where: { workflowStepId, workflow: { workflowId } },
    });
    if (!step) {
      throw new NotFoundException(
        `Step ${workflowStepId} not found on workflow ${workflowId}`
      );
    }

    const oldOrder = step.stepOrder;
    if (oldOrder === newOrder) return step;

    // Get all steps for this workflow
    const allSteps = await this.stepsRepo.find({
      where: { workflow: { workflowId } },
      order: { stepOrder: "ASC" },
    });

    // Update orders
    if (newOrder > oldOrder) {
      // Moving down: decrement steps between old and new position
      for (const s of allSteps) {
        if (s.stepOrder > oldOrder && s.stepOrder <= newOrder) {
          s.stepOrder -= 1;
          await this.stepsRepo.save(s);
        }
      }
    } else {
      // Moving up: increment steps between new and old position
      for (const s of allSteps) {
        if (s.stepOrder >= newOrder && s.stepOrder < oldOrder) {
          s.stepOrder += 1;
          await this.stepsRepo.save(s);
        }
      }
    }

    // Update the moved step
    step.stepOrder = newOrder;
    return this.stepsRepo.save(step);
  }

  /** Used by RequestsService to advance a request through the workflow. */
  async getFirstStep(workflowId: number, variables: { label: string; value: string }[] = []): Promise<WorkflowStep | null> {
    const steps = await this.stepsRepo.find({
      where: { workflow: { workflowId } },
      order: { stepOrder: "ASC" },
      relations: { approverRole: true },
    });
    const transitions = await this.transitionsRepo.find({
      where: { workflow: { workflowId } },
      relations: { fromStep: true, toStep: { approverRole: true } },
    });
    return this.resolveConditionChain(steps[0] ?? null, steps, transitions, variables);
  }

  async getNextStep(
    workflowId: number,
    currentStepOrder: number,
    variables: { label: string; value: string }[] = []
  ): Promise<WorkflowStep | null> {
    const steps = await this.stepsRepo.find({
      where: { workflow: { workflowId } },
      order: { stepOrder: "ASC" },
      relations: { approverRole: true },
    });
    const transitions = await this.transitionsRepo.find({
      where: { workflow: { workflowId } },
      relations: { fromStep: true, toStep: { approverRole: true } },
    });
    const next = steps.find((s) => s.stepOrder > currentStepOrder) ?? null;
    return this.resolveConditionChain(next, steps, transitions, variables);
  }

  private resolveConditionChain(
    initial: WorkflowStep | null,
    steps: WorkflowStep[],
    transitions: WorkflowTransition[],
    variables: { label: string; value: string }[]
  ): WorkflowStep | null {
    let current = initial;
    const visited = new Set<number>();
    while (current?.stepType === "condition" && !visited.has(current.workflowStepId)) {
      visited.add(current.workflowStepId);
      const branch = this.evaluateCondition(current.conditionExpression, variables) ? "yes" : "no";
      const transition = transitions.find(
        (item) => item.fromStep.workflowStepId === current?.workflowStepId && item.branch === branch
      );
      current = transition?.toStep ?? steps.find((step) => step.stepOrder > current!.stepOrder) ?? null;
    }
    return current;
  }

  private evaluateCondition(expression: string | undefined, variables: { label: string; value: string }[]): boolean {
    if (!expression?.trim()) return false;
    const operators = [" not equals ", " equals ", " contains ", " is true", " is false", " >= ", " <= ", " != ", " == ", " > ", " < "];
    const lower = expression.toLowerCase();
    const operator = operators.find((candidate) => lower.includes(candidate));
    if (!operator) return false;
    const index = lower.indexOf(operator);
    const label = expression.slice(0, index).trim();
    const expected = expression.slice(index + operator.length).trim();
    const actual = variables.find((item) => item.label.toLowerCase() === label.toLowerCase())?.value ?? "";
    const left = actual.toLowerCase();
    const right = expected.toLowerCase();
    switch (operator.trim()) {
      case "equals": case "==": return left === right;
      case "not equals": case "!=": return left !== right;
      case "contains": return left.includes(right);
      case "is true": return ["true", "yes", "1"].includes(left);
      case "is false": return ["false", "no", "0", ""].includes(left);
      case ">": return Number(actual) > Number(expected);
      case "<": return Number(actual) < Number(expected);
      case ">=": return Number(actual) >= Number(expected);
      case "<=": return Number(actual) <= Number(expected);
      default: return false;
    }
  }
}
