import { Injectable } from "@nestjs/common";
import { Actor, RequestsService } from "../requests.service";
import { RequestActionDto } from "../dto/request-action.dto";

/** Thin facade: the approval-chain logic lives in RequestsService next to the rest of the lifecycle. */
@Injectable()
export class ApprovalsService {
  constructor(private requestsService: RequestsService) {}

  /** Requests waiting on this user, followed by ones they already decided. */
  findForUser(actor: Actor) {
    return this.requestsService.approvalsFor(actor);
  }

  act(requestId: number, actor: Actor, dto: RequestActionDto) {
    return this.requestsService.actOnApproval(
      requestId,
      actor,
      dto.action,
      dto.comments,
      dto.requestApprovalId,
    );
  }

  requestInfo(requestId: number, actor: Actor, question: string) {
    return this.requestsService.requestInfo(requestId, actor, question);
  }

  delegate(requestId: number, actor: Actor, toUserId: number, comments?: string) {
    return this.requestsService.delegate(requestId, actor, toUserId, comments);
  }
}
