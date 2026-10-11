import { Injectable, ForbiddenException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ServiceRequest } from "../entities/request.entity";
import { User } from "../../users/entities/user.entity";
import { RolesService } from "../../roles/roles.service";
import { RequestsService } from "../requests.service";
import { RequestActionDto } from "../dto/request-action.dto";

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(ServiceRequest)
    private requestsRepo: Repository<ServiceRequest>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private rolesService: RolesService,
    private requestsService: RequestsService
  ) {}

  /**
   * Approvals screen: requests waiting on either
   *  (a) the workflow-level approval gate (status "Pending Approval",
   *      gated by the workflow's own approverRole), or
   *  (b) a step whose approverRole the user holds (status "In Progress").
   * Each result is tagged with `approvalStage` so the UI can tell which
   * kind of decision it is (and which endpoint/labels to show), even
   * though both are resolved through the same POST /approvals/:id/action.
   */
  async findPendingForUser(
    userId: number
  ): Promise<(ServiceRequest & { approvalStage: "workflow" | "step" })[]> {
    const userRoleNames = await this.rolesService.getRoleNamesForUser(userId);
    if (!userRoleNames.length) {
      return [];
    }

    const workflowGatePending = await this.requestsRepo
      .createQueryBuilder("request")
      .leftJoinAndSelect("request.catalog", "catalog")
      .leftJoinAndSelect("catalog.workflow", "workflow")
      .leftJoinAndSelect("workflow.approverRole", "workflowApproverRole")
      .leftJoinAndSelect("request.requestedBy", "requestedBy")
      .where("request.status = :status", { status: "Pending Approval" })
      .andWhere("workflowApproverRole.roleName IN (:...roleNames)", { roleNames: userRoleNames })
      .orderBy("request.createdAt", "ASC")
      .getMany();

    const stepPending = await this.requestsRepo
      .createQueryBuilder("request")
      .leftJoinAndSelect("request.catalog", "catalog")
      .leftJoinAndSelect("request.requestedBy", "requestedBy")
      .leftJoinAndSelect("request.currentStep", "currentStep")
      .leftJoinAndSelect("currentStep.approverRole", "approverRole")
      .where("request.status = :status", { status: "In Progress" })
      .andWhere("approverRole.roleName IN (:...roleNames)", { roleNames: userRoleNames })
      .orderBy("request.createdAt", "ASC")
      .getMany();

    return [
      ...workflowGatePending.map((r) => Object.assign(r, { approvalStage: "workflow" as const })),
      ...stepPending.map((r) => Object.assign(r, { approvalStage: "step" as const })),
    ];
  }

  async act(
    requestId: number,
    userId: number,
    dto: RequestActionDto
  ): Promise<ServiceRequest> {
    const request = await this.requestsService.findOne(requestId);
    const actingUser = await this.usersRepo.findOne({ where: { userId } });
    if (!actingUser) {
      throw new ForbiddenException("Acting user not found");
    }

    const userRoleNames = await this.rolesService.getRoleNamesForUser(userId);

    // A request awaiting the workflow-level gate is authorized against the
    // workflow's own approverRole, not any step's — there is no current
    // step yet at this point.
    if (request.status === "Pending Approval") {
      const requiredRole = request.catalog.workflow?.approverRole?.roleName;
      if (!requiredRole || !userRoleNames.includes(requiredRole)) {
        throw new ForbiddenException(
          "You do not have the required role to approve this request"
        );
      }
      return this.requestsService.actOnWorkflowApproval(
        requestId,
        dto.action,
        actingUser,
        dto.comments
      );
    }

    // Authorization check: the user must hold the role required by the current step
    const requiredRole = request.currentStep?.approverRole?.roleName;
    if (!requiredRole || !userRoleNames.includes(requiredRole)) {
      throw new ForbiddenException(
        "You do not have the required role to act on this request"
      );
    }

    return this.requestsService.advanceWorkflow(
      requestId,
      dto.action,
      actingUser,
      dto.comments
    );
  }
}
