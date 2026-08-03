import { Controller, Get, Post, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { ParseIntPipe } from "../../../common/pipes/parse-int.pipe";
import { ApprovalsService } from "./approvals.service";
import { RequestActionDto } from "../dto/request-action.dto";

@ApiTags("approvals")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("approvals")
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  /** Approvals screen: requests waiting on the current user's role */
  @Get()
  findPending(@CurrentUser("userId") userId: number) {
    return this.approvalsService.findPendingForUser(userId);
  }

  @Post(":requestId/action")
  act(
    @Param("requestId", ParseIntPipe) requestId: number,
    @CurrentUser("userId") userId: number,
    @Body() dto: RequestActionDto
  ) {
    return this.approvalsService.act(requestId, userId, dto);
  }
}
