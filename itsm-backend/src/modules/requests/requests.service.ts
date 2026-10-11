import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { ServiceRequest } from "./entities/request.entity";
import { RequestVariableValue } from "./entities/request-variable-value.entity";
import { RequestHistory } from "./entities/request-history.entity";
import { Catalog } from "../catalogs/entities/catalog.entity";
import { CatalogVariable } from "../catalogs/entities/catalog-variable.entity";
import { User } from "../users/entities/user.entity";
import { WorkflowStep } from "../workflows/entities/workflow-step.entity";
import { Workflow } from "../workflows/entities/workflow.entity";
import { Role } from "../roles/entities/role.entity";
import { WorkflowsService } from "../workflows/workflows.service";
import { RolesService } from "../roles/roles.service";
import { CreateRequestDto } from "./dto/create-request.dto";
import { UpdateRequestDto } from "./dto/update-request.dto";
import { MailService } from "../mail/mail.service";

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    @InjectRepository(ServiceRequest)
    private requestsRepo: Repository<ServiceRequest>,
    @InjectRepository(RequestVariableValue)
    private valuesRepo: Repository<RequestVariableValue>,
    @InjectRepository(RequestHistory)
    private historyRepo: Repository<RequestHistory>,
    @InjectRepository(Catalog) private catalogsRepo: Repository<Catalog>,
    @InjectRepository(CatalogVariable)
    private catalogVariablesRepo: Repository<CatalogVariable>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private dataSource: DataSource,
    private workflowsService: WorkflowsService,
    private rolesService: RolesService,
    private mailService: MailService
  ) {}

  /**
   * Emails everyone holding the step's approver role that a request is
   * waiting on them. Failures are logged, not thrown — a bad SMTP config
   * shouldn't block the request from being submitted/advanced.
   */
  private async notifyApproversForRole(
    role: Role | undefined,
    requestId: number,
    catalogName: string
  ): Promise<void> {
    if (!role) return;
    try {
      const approvers = await this.rolesService.getUsersForRole(role.roleId);
      const activeApprovers = approvers.filter((a) => a.isActive);
      await Promise.all(
        activeApprovers.map((approver) =>
          this.mailService.sendApprovalRequestEmail(
            approver.email,
            requestId,
            catalogName
          )
        )
      );
    } catch (err) {
      this.logger.warn(
        `Failed to notify approvers for request ${requestId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  /** Back-compat wrapper: notify a step's approver role. */
  private async notifyApprovers(
    step: WorkflowStep,
    requestId: number,
    catalogName: string
  ): Promise<void> {
    return this.notifyApproversForRole(step.approverRole, requestId, catalogName);
  }

  /** Notify a workflow's own approver role (the pre-first-step approval gate). */
  private async notifyWorkflowApprovers(
    workflow: Workflow,
    requestId: number,
    catalogName: string
  ): Promise<void> {
    return this.notifyApproversForRole(workflow.approverRole, requestId, catalogName);
  }

  /** "Request Submitted" screen action */
  async create(
    requestedByUserId: number,
    dto: CreateRequestDto,
    submittedByUserId = requestedByUserId
  ): Promise<ServiceRequest> {
    const catalog = await this.catalogsRepo.findOne({
      where: { catalogId: dto.catalogId },
      relations: { workflow: true },
    });
    if (!catalog) {
      throw new NotFoundException(`Catalog ${dto.catalogId} not found`);
    }

    const requestedBy = await this.usersRepo.findOne({
      where: { userId: requestedByUserId },
    });
    if (!requestedBy) {
      throw new NotFoundException(`User ${requestedByUserId} not found`);
    }
    const submittedBy = submittedByUserId === requestedByUserId
      ? requestedBy
      : await this.usersRepo.findOne({ where: { userId: submittedByUserId } });
    if (!submittedBy) {
      throw new NotFoundException(`User ${submittedByUserId} not found`);
    }

    // Validate every submitted variableId actually belongs to this catalog
    const catalogVariables = await this.catalogVariablesRepo.find({
      where: { catalog: { catalogId: dto.catalogId } },
    });
    const validVariableIds = new Set(catalogVariables.map((v) => v.variableId));
    for (const vv of dto.variableValues) {
      if (!validVariableIds.has(vv.variableId)) {
        throw new BadRequestException(
          `Variable ${vv.variableId} does not belong to catalog ${dto.catalogId}`
        );
      }
    }
    // Ensure all mandatory fields were supplied
    const submittedIds = new Set(dto.variableValues.map((v) => v.variableId));
    const missingMandatory = catalogVariables.filter(
      (v) => v.isMandatory && !submittedIds.has(v.variableId)
    );
    if (missingMandatory.length) {
      throw new BadRequestException(
        `Missing required fields: ${missingMandatory.map((v) => v.label).join(", ")}`
      );
    }

    // A workflow-level approval gate holds the request before its first step
    // runs at all — distinct from a per-step `approval` step further down
    // the chain, which still works independently once the gate clears.
    const requiresWorkflowApproval = !!catalog.workflow?.requiresApproval;

    const firstStep = catalog.workflow && !requiresWorkflowApproval
      ? await this.workflowsService.getFirstStep(
          catalog.workflow.workflowId,
          dto.variableValues.map((value) => ({
            label: catalogVariables.find((variable) => variable.variableId === value.variableId)?.label ?? "",
            value: value.value,
          }))
        )
      : undefined;

    const request = this.requestsRepo.create({
      status: requiresWorkflowApproval ? "Pending Approval" : firstStep ? "In Progress" : "Submitted",
    });
    request.catalog = catalog;
    request.requestedBy = requestedBy;
    if (firstStep) request.currentStep = firstStep;
    const savedRequest = await this.requestsRepo.save(request);

    const values = dto.variableValues.map((vv) => {
      const val = this.valuesRepo.create({
        variable: { variableId: vv.variableId } as CatalogVariable,
        value: vv.value,
      });
      val.request = savedRequest;
      return val;
    });
    await this.valuesRepo.save(values);

    const histEntry = this.historyRepo.create({
      action: "Submitted",
      actionBy: submittedBy,
      comments: submittedByUserId === requestedByUserId
        ? undefined
        : `Submitted by an administrator for ${requestedBy.fullName}`,
    });
    histEntry.request = savedRequest;
    if (firstStep) histEntry.workflowStep = firstStep;
    await this.historyRepo.save(histEntry);

    if (requiresWorkflowApproval && catalog.workflow) {
      await this.notifyWorkflowApprovers(
        catalog.workflow,
        savedRequest.requestId,
        catalog.catalogName
      );
    } else if (firstStep?.approverRole) {
      await this.notifyApprovers(
        firstStep,
        savedRequest.requestId,
        catalog.catalogName
      );
    }

    return this.findOne(savedRequest.requestId);
  }

  async update(
    requestId: number,
    actingUserId: number,
    dto: UpdateRequestDto
  ): Promise<ServiceRequest> {
    const request = await this.findOne(requestId);
    if (request.status !== "Submitted") {
      throw new BadRequestException(
        "Only submitted requests can be edited; requests already in workflow cannot be changed"
      );
    }

    const actingUser = await this.usersRepo.findOne({ where: { userId: actingUserId } });
    if (!actingUser) {
      throw new NotFoundException(`User ${actingUserId} not found`);
    }

    const catalogVariables = await this.catalogVariablesRepo.find({
      where: { catalog: { catalogId: request.catalog.catalogId } },
    });
    const validVariableIds = new Set(catalogVariables.map((variable) => variable.variableId));
    const submittedIds = new Set<number>();
    for (const value of dto.variableValues) {
      if (submittedIds.has(value.variableId)) {
        throw new BadRequestException(`Variable ${value.variableId} was submitted more than once`);
      }
      submittedIds.add(value.variableId);
      if (!validVariableIds.has(value.variableId)) {
        throw new BadRequestException(
          `Variable ${value.variableId} does not belong to catalog ${request.catalog.catalogId}`
        );
      }
    }

    const missingMandatory = catalogVariables.filter(
      (variable) => variable.isMandatory && !submittedIds.has(variable.variableId)
    );
    if (missingMandatory.length) {
      throw new BadRequestException(
        `Missing required fields: ${missingMandatory.map((variable) => variable.label).join(", ")}`
      );
    }

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const requestRepo = runner.manager.getRepository(ServiceRequest);
      const valuesRepo = runner.manager.getRepository(RequestVariableValue);
      const historyRepo = runner.manager.getRepository(RequestHistory);
      const current = await requestRepo.findOne({ where: { requestId } });
      if (!current) {
        throw new NotFoundException(`Request ${requestId} not found`);
      }
      if (current.status !== "Submitted") {
        throw new BadRequestException(
          "Only submitted requests can be edited; requests already in workflow cannot be changed"
        );
      }

      const oldValues = await valuesRepo.find({
        where: { request: { requestId } },
      });
      if (oldValues.length) {
        await valuesRepo.delete(oldValues.map((value) => value.valueId));
      }
      const newValues = dto.variableValues.map((value) => {
        const requestValue = valuesRepo.create({
          variable: { variableId: value.variableId } as CatalogVariable,
          value: value.value,
        });
        requestValue.request = current;
        return requestValue;
      });
      if (newValues.length) await valuesRepo.save(newValues);

      const history = historyRepo.create({
        request: current,
        action: "Updated",
        actionBy: actingUser,
        comments: dto.comments?.trim() || "Updated by administrator",
      });
      await historyRepo.save(history);
      await requestRepo.save(current);
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }

    return this.findOne(requestId);
  }

  findAllForUser(userId: number): Promise<ServiceRequest[]> {
    return this.requestsRepo.find({
      where: { requestedBy: { userId } },
      relations: { catalog: true, currentStep: true },
      order: { createdAt: "DESC" },
    });
  }

  findAll(): Promise<ServiceRequest[]> {
    return this.requestsRepo.find({
      relations: { catalog: true, requestedBy: true, currentStep: true },
      order: { createdAt: "DESC" },
    });
  }

  async findOne(requestId: number): Promise<ServiceRequest> {
    const request = await this.requestsRepo.findOne({
      where: { requestId },
      relations: {
        catalog: { workflow: { approverRole: true } },
        requestedBy: true,
        currentStep: { approverRole: true },
        variableValues: { variable: true },
      },
    });
    if (!request) {
      throw new NotFoundException(`Request ${requestId} not found`);
    }
    return request;
  }

  /**
   * Advances (or closes) a request after an approve/reject action.
   * Used by ApprovalsService — kept here since it's core request state logic.
   */
  async advanceWorkflow(
    requestId: number,
    action: "Approved" | "Rejected",
    actingUser: User,
    comments?: string
  ): Promise<ServiceRequest> {
    const request = await this.findOne(requestId);

    if (request.status !== "In Progress") {
      throw new BadRequestException(
        `Request ${requestId} is not awaiting approval (status: ${request.status})`
      );
    }

    const histEntry = this.historyRepo.create({
      action,
      actionBy: actingUser,
      comments: comments ?? undefined,
    });
    histEntry.request = request;
    if (request.currentStep) histEntry.workflowStep = request.currentStep;
    await this.historyRepo.save(histEntry);

    if (action === "Rejected") {
      request.status = "Rejected";
      request.currentStep = undefined;
      request.closedAt = new Date();
      return this.requestsRepo.save(request);
    }

    const workflowId = request.catalog.workflow?.workflowId;
    const nextStep = workflowId && request.currentStep
      ? await this.workflowsService.getNextStep(
          workflowId,
          request.currentStep.stepOrder,
          request.variableValues.map((value) => ({ label: value.variable.label, value: value.value }))
        )
      : undefined;

    if (nextStep) {
      request.currentStep = nextStep;
      request.status = "In Progress";
      const saved = await this.requestsRepo.save(request);
      if (nextStep.approverRole) {
        await this.notifyApprovers(
          nextStep,
          saved.requestId,
          request.catalog.catalogName
        );
      }
      return saved;
    }

    request.status = "Approved";
    request.currentStep = undefined;
    request.closedAt = new Date();

    return this.requestsRepo.save(request);
  }

  /**
   * Resolves the workflow-level approval gate (ServiceRequest.status ===
   * "Pending Approval"). On approval, proceeds exactly like a fresh request
   * would: resolves the first (non-gate) step via getFirstStep and moves to
   * "In Progress", or straight to "Approved" if the workflow has no steps.
   * On rejection, closes the request without ever entering the step chain.
   * Used by ApprovalsService, mirroring advanceWorkflow() above.
   */
  async actOnWorkflowApproval(
    requestId: number,
    action: "Approved" | "Rejected",
    actingUser: User,
    comments?: string
  ): Promise<ServiceRequest> {
    const request = await this.findOne(requestId);

    if (request.status !== "Pending Approval") {
      throw new BadRequestException(
        `Request ${requestId} is not awaiting workflow approval (status: ${request.status})`
      );
    }

    const histEntry = this.historyRepo.create({
      action,
      actionBy: actingUser,
      comments: comments ?? undefined,
    });
    histEntry.request = request;
    // No workflowStep yet — this decision happens before the step chain starts.
    await this.historyRepo.save(histEntry);

    if (action === "Rejected") {
      request.status = "Rejected";
      request.closedAt = new Date();
      return this.requestsRepo.save(request);
    }

    const workflowId = request.catalog.workflow?.workflowId;
    const firstStep = workflowId
      ? await this.workflowsService.getFirstStep(
          workflowId,
          request.variableValues.map((value) => ({ label: value.variable.label, value: value.value }))
        )
      : undefined;

    if (firstStep) {
      request.currentStep = firstStep;
      request.status = "In Progress";
      const saved = await this.requestsRepo.save(request);
      if (firstStep.approverRole) {
        await this.notifyApprovers(firstStep, saved.requestId, request.catalog.catalogName);
      }
      return saved;
    }

    request.status = "Approved";
    request.closedAt = new Date();
    return this.requestsRepo.save(request);
  }

  /**
   * "My requests" screen action: lets a requester withdraw their own
   * request while it hasn't been finalized yet. Admins may cancel any
   * request (e.g. on behalf of a requester who left the company).
   */
  async cancel(
    requestId: number,
    actingUserId: number,
    isAdmin: boolean,
    comments?: string
  ): Promise<ServiceRequest> {
    const request = await this.findOne(requestId);
    const actingUser = await this.usersRepo.findOne({
      where: { userId: actingUserId },
    });
    if (!actingUser) {
      throw new NotFoundException(`User ${actingUserId} not found`);
    }

    if (!isAdmin && request.requestedBy.userId !== actingUser.userId) {
      throw new ForbiddenException("You can only cancel your own requests");
    }

    if (request.status === "Rejected" || request.status === "Closed") {
      throw new BadRequestException(
        `Request ${requestId} is already ${request.status.toLowerCase()} and cannot be cancelled`
      );
    }

    const histEntry = this.historyRepo.create({
      action: "Cancelled",
      actionBy: actingUser,
      comments: comments ?? undefined,
    });
    histEntry.request = request;
    if (request.currentStep) histEntry.workflowStep = request.currentStep;
    await this.historyRepo.save(histEntry);

    request.status = "Closed";
    request.currentStep = undefined;
    request.closedAt = new Date();

    return this.requestsRepo.save(request);
  }
}
