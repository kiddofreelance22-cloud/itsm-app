import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export const REQUEST_TASK_STATUSES = ["Open", "In Progress", "Completed", "Cancelled"] as const;

export class AssignRequestDto {
  @IsOptional() @IsInt() assignmentGroupId?: number;
  @IsOptional() @IsInt() assigneeId?: number;
  /** Move an Approved request straight to In Progress. */
  @IsOptional() @IsBoolean() start?: boolean;
  @IsOptional() @IsString() comments?: string;
}
export class HoldRequestDto {
  @IsOptional() @IsInt() pendingReasonId?: number;
  /** A custom status from the On hold stage. */
  @IsOptional() @IsString() subStatus?: string;
  @IsOptional() @IsString() notes?: string;
}
export class SubStatusDto {
  /** A custom status from the In progress stage; null clears it. */
  @IsOptional() @IsString() subStatus?: string | null;
}
export class FulfilRequestDto {
  @IsInt() closureCodeId!: number;
  @IsString() @MinLength(1) notes!: string;
}
export class CloseRequestDto {
  @IsOptional() @IsString() comments?: string;
}
export class ReopenRequestDto {
  @IsString() @MinLength(1) comments!: string;
}
export class RateRequestDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() comment?: string;
}
export class ClassifyRequestDto {
  @IsOptional() @IsInt() urgencyId?: number;
  @IsOptional() @IsInt() serviceImpactId?: number;
}
export class CommentRequestDto {
  @IsString() @MinLength(1) comments!: string;
}
export class ResubmitRequestDto {
  @IsOptional() @IsString() comments?: string;
}
export class DelegateApprovalDto {
  @IsInt() toUserId!: number;
  @IsOptional() @IsString() comments?: string;
}
export class UpdateRequestTaskDto {
  @IsIn(REQUEST_TASK_STATUSES as unknown as string[]) status!: (typeof REQUEST_TASK_STATUSES)[number];
}
export class RequestQueueQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsInt() groupId?: number;
  /** "me", "unassigned" or a user id. */
  @IsOptional() @IsString() assignee?: string;
  @IsOptional() @IsInt() priorityId?: number;
  @IsOptional() @IsString() q?: string;
  /** "breached" | "at_risk" */
  @IsOptional() @IsString() sla?: string;
  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(200) pageSize?: number;
}
