import { Controller, Get, Post, Body, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { RequestsService } from "./requests.service";
import { CreateRequestDto } from "./dto/create-request.dto";
import { CreateAdminRequestDto } from "./dto/create-admin-request.dto";
import { CancelRequestDto } from "./dto/cancel-request.dto";
import { UpdateRequestDto } from "./dto/update-request.dto";

@ApiTags("requests")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("requests")
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  /** Request Submission screen action */
  @Post()
  create(@CurrentUser("userId") userId: number, @Body() dto: CreateRequestDto) {
    return this.requestsService.create(userId, dto);
  }

  @Post("admin")
  @Roles("Admin")
  createForUser(
    @CurrentUser("userId") adminUserId: number,
    @Body() dto: CreateAdminRequestDto
  ) {
    const { requestedById, ...request } = dto;
    return this.requestsService.create(requestedById, request, adminUserId);
  }

  /** "My requests" list for the logged-in requester */
  @Get("mine")
  findMine(@CurrentUser("userId") userId: number) {
    return this.requestsService.findAllForUser(userId);
  }

  @Get()
  @Roles("Admin")
  findAll() {
    return this.requestsService.findAll();
  }

  @Get(":requestId")
  findOne(@Param("requestId", ParseIntPipe) requestId: number) {
    return this.requestsService.findOne(requestId);
  }

  @Patch(":requestId")
  @Roles("Admin")
  update(
    @Param("requestId", ParseIntPipe) requestId: number,
    @CurrentUser("userId") adminUserId: number,
    @Body() dto: UpdateRequestDto
  ) {
    return this.requestsService.update(requestId, adminUserId, dto);
  }

  /** "My requests" screen action: withdraw a request that hasn't been finalized. */
  @Post(":requestId/cancel")
  cancel(
    @Param("requestId", ParseIntPipe) requestId: number,
    @CurrentUser("userId") userId: number,
    @CurrentUser("roles") roles: string[],
    @Body() dto: CancelRequestDto
  ) {
    return this.requestsService.cancel(
      requestId,
      userId,
      (roles ?? []).includes("Admin"),
      dto.comments
    );
  }
}
