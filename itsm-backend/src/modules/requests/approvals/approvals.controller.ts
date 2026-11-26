import { Controller, Get, Post, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { ParseIntPipe } from "../../../common/pipes/parse-int.pipe";
import { ApprovalsService } from "./approvals.service";
import { RequestActionDto } from "../dto/request-action.dto";
import { CommentRequestDto, DelegateApprovalDto } from "../dto/request-lifecycle.dto";
import type { Actor } from "../requests.service";

@ApiTags("approvals")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("approvals")
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  /** Approve Service Requests screen: waiting on me, plus what I already decided. */
  @Get()
  findForUser(@CurrentUser() user: Actor) {
    return this.approvalsService.findForUser(user);
  }

  @Post(":requestId/action")
  act(
    @Param("requestId", ParseIntPipe) requestId: number,
    @CurrentUser() user: Actor,
    @Body() dto: RequestActionDto
  ) {
    return this.approvalsService.act(requestId, user, dto);
  }

  /** The approver asks the requester a question. The request returns to this approver once it is answered. */
  @Post(":requestId/request-info")
  requestInfo(@Param("requestId", ParseIntPipe) requestId: number, @CurrentUser() user: Actor, @Body() dto: CommentRequestDto) {
    return this.approvalsService.requestInfo(requestId, user, dto.comments);
  }

  /** The approver hands the approval to someone else, who then decides alone. */
  @Post(":requestId/delegate")
  delegate(@Param("requestId", ParseIntPipe) requestId: number, @CurrentUser() user: Actor, @Body() dto: DelegateApprovalDto) {
    return this.approvalsService.delegate(requestId, user, dto.toUserId, dto.comments);
  }
}
