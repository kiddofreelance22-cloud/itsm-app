import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ServiceRequest } from "./entities/request.entity";
import { RequestVariableValue } from "./entities/request-variable-value.entity";
import { RequestHistory } from "./entities/request-history.entity";
import { Catalog } from "../catalogs/entities/catalog.entity";
import { CatalogVariable } from "../catalogs/entities/catalog-variable.entity";
import { User } from "../users/entities/user.entity";
import { WorkflowsService } from "../workflows/workflows.service";
import { CreateRequestDto } from "./dto/create-request.dto";
import { MailService } from "../mail/mail.service";

@Injectable()
export class RequestsService {
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
    private workflowsService: WorkflowsService,
    private mailService: MailService
  ) {}

  /** "Request Submitted" screen action */
  async create(
    requestedByUserId: number,
    dto: CreateRequestDto
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

    const firstStep = catalog.workflow
      ? await this.workflowsService.getFirstStep(catalog.workflow.workflowId)
      : null;

    const request = this.requestsRepo.create({
      catalog,
      requestedBy,
      status: firstStep ? "In Progress" : "Submitted",
      currentStep: firstStep,
    });
    const savedRequest = await this.requestsRepo.save(request);

    const values = dto.variableValues.map((vv) =>
      this.valuesRepo.create({
        request: savedRequest,
        variable: { variableId: vv.variableId } as CatalogVariable,
        value: vv.value,
      })
    );
    await this.valuesRepo.save(values);

    await this.historyRepo.save(
      this.historyRepo.create({
        request: savedRequest,
        workflowStep: firstStep,
        action: "Submitted",
        actionBy: requestedBy,
        comments: null as any,
      })
    );

    if (firstStep?.approverRole) {
      // In a full implementation, look up users with this role and email each one.
      // Left as a hook here since "notify all approvers" needs a role -> users query.
    }

    return this.findOne(savedRequest.requestId);
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
        catalog: { workflow: true },
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

    await this.historyRepo.save(
      this.historyRepo.create({
        request,
        workflowStep: request.currentStep,
        action,
        actionBy: actingUser,
        comments: comments ?? (null as any),
      })
    );

    if (action === "Rejected") {
      request.status = "Rejected";
      request.currentStep = null;
      request.closedAt = new Date();
      return this.requestsRepo.save(request);
    }

    // Approved -> move to next step, or close out if this was the last step
    const workflowId = request.catalog.workflow?.workflowId;
    const nextStep = workflowId && request.currentStep
      ? await this.workflowsService.getNextStep(
          workflowId,
          request.currentStep.stepOrder
        )
      : null;

    if (nextStep) {
      request.currentStep = nextStep;
      request.status = "In Progress";
    } else {
      request.status = "Approved";
      request.currentStep = null;
      request.closedAt = new Date();
    }

    return this.requestsRepo.save(request);
  }
}
