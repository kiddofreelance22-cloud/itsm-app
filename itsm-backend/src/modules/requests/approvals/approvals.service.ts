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

  /** Approvals screen: requests currently waiting on a step whose approverRole the user holds. */
  async findPendingForUser(userId: number): Promise<ServiceRequest[]> {
    const userRoleNames = await this.rolesService.getRoleNamesForUser(userId);

    const inProgress = await this.requestsRepo.find({
      where: { status: "In Progress" },
      relations: { catalog: true, requestedBy: true, currentStep: { approverRole: true } },
      order: { createdAt: "ASC" },
    });

    return inProgress.filter(
      (r) =>
        r.currentStep?.approverRole &&
        userRoleNames.includes(r.currentStep.approverRole.roleName)
    );
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

    // Authorization check: the user must hold the role required by the current step
    const userRoleNames = await this.rolesService.getRoleNamesForUser(userId);
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
