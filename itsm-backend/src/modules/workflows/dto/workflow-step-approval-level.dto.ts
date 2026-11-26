import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";

export class WorkflowStepApprovalLevelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  approvalLevelId?: number;

  @ApiProperty()
  @IsInt()
  levelNumber: number;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ enum: ["user", "group", "role", "custom", "requester_manager", "parallel"] })
  @IsIn(["user", "group", "role", "custom", "requester_manager", "parallel"])
  approverType: "user" | "group" | "role" | "custom" | "requester_manager" | "parallel";

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  approverId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoApproval?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNotificationsForEndUser?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  referBackToRequestor?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  referBackToPreviousApprovers?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  customGroupId?: number;

  @ApiPropertyOptional({ enum: ["any", "majority", "all"] })
  @IsOptional()
  @IsIn(["any", "majority", "all"])
  approvalRule?: "any" | "majority" | "all";

  @ApiPropertyOptional({ description: "parallel levels: [{type, ref}] asked at the same time" })
  @IsOptional()
  @IsArray()
  approvers?: { type: "user" | "group" | "role" | "custom" | "requester_manager"; ref?: number | null; label?: string }[];

  @ApiPropertyOptional({ enum: ["optional", "reject", "both"], description: "When the approver must leave a comment" })
  @IsOptional() @IsIn(["optional", "reject", "both"]) commentPolicy?: "optional" | "reject" | "both";
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowReject?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowInfo?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowDelegate?: boolean;
  @ApiPropertyOptional({ description: "Business days before a reminder is sent (0 = none)" }) @IsOptional() @IsInt() @Min(0) @Max(365) remindDays?: number;
  @ApiPropertyOptional({ description: "Business days before the step times out (0 = never)" }) @IsOptional() @IsInt() @Min(0) @Max(365) timeoutDays?: number;
  @ApiPropertyOptional({ enum: ["escalate", "approve", "reject"] }) @IsOptional() @IsIn(["escalate", "approve", "reject"]) onTimeout?: "escalate" | "approve" | "reject";
  @ApiPropertyOptional({ description: "escalate: <type>:<id>" }) @IsOptional() @IsString() timeoutArg?: string | null;

  @ApiPropertyOptional({ enum: ["next", "fulfil", "step", "notify", "priority", "assign", "reroute", "task", "auto"] })
  @IsOptional()
  @IsIn(["next", "fulfil", "step", "notify", "priority", "assign", "reroute", "task", "auto"])
  onApprove?: "next" | "fulfil" | "step" | "notify" | "priority" | "assign" | "reroute" | "task" | "auto";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approveArg?: string | null;

  @ApiPropertyOptional({ enum: ["close", "rework", "back", "escalate", "continue"] })
  @IsOptional()
  @IsIn(["close", "rework", "back", "escalate", "continue"])
  onReject?: "close" | "rework" | "back" | "escalate" | "continue";

  @ApiPropertyOptional({ description: "back: earlier approvalLevelId; escalate: type:id; rework: start|this" })
  @IsOptional()
  @IsString()
  rejectArg?: string | null;
}

export class ReplaceWorkflowStepApprovalLevelsDto {
  @ApiProperty({ type: [WorkflowStepApprovalLevelDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepApprovalLevelDto)
  levels: WorkflowStepApprovalLevelDto[];
}