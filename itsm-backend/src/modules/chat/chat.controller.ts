import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ChatService } from "./chat.service";

class SendDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) message!: string;
  @IsOptional() @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) sessionId?: string;
}
class FeedbackDto {
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) messageId!: string;
  @IsIn([1, -1]) rating!: number;
  @IsOptional() @IsString() @Matches(/^[^\r\n]*$/) @MaxLength(500) comment?: string;
}
class ActionDto {
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) sessionId!: string;
  @IsOptional() @IsObject() edits?: Record<string, unknown>;
}
class AdminFeedbackQueryDto {
  @IsOptional() @Transform(({ value }) => value === undefined ? undefined : Number(value)) @IsIn([1, -1]) rating?: 1 | -1;
}

@ApiTags("Chat") @ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("chat")
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post("message")
  send(
    @CurrentUser("userId") userId: number,
    @CurrentUser("roles") roles: string[],
    @Body() dto: SendDto,
  ) { return this.chat.send(userId, dto.message, dto.sessionId, roles ?? []); }

  @Post("actions/:id/confirm")
  confirmAction(
    @CurrentUser("userId") userId: number,
    @CurrentUser("roles") roles: string[],
    @Param("id") id: string,
    @Body() dto: ActionDto,
  ) { return this.chat.confirmAction(userId, id, dto.sessionId, dto.edits, roles ?? []); }

  @Post("actions/:id/cancel")
  cancelAction(
    @CurrentUser("userId") userId: number,
    @Param("id") id: string,
    @Body() dto: ActionDto,
  ) { return this.chat.cancelAction(userId, id, dto.sessionId); }

  @Post("feedback")
  feedback(@CurrentUser("userId") userId: number, @Body() dto: FeedbackDto) { return this.chat.feedback(userId, dto.messageId, dto.rating, dto.comment); }

  @Get("sessions/:id")
  history(@CurrentUser("userId") userId: number, @Param("id") id: string) { return this.chat.history(userId, id); }

  @Get("admin/feedback")
  @UseGuards(RolesGuard)
  @Roles("Admin")
  adminFeedback(@Query() query: AdminFeedbackQueryDto) { return this.chat.adminFeedback(query.rating); }
}
