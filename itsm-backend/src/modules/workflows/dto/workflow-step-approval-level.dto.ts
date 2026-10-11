import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, ValidateNested } from "class-validator";

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

  @ApiProperty({ enum: ["user", "group", "role", "custom"] })
  @IsIn(["user", "group", "role", "custom"])
  approverType: "user" | "group" | "role" | "custom";

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
}

export class ReplaceWorkflowStepApprovalLevelsDto {
  @ApiProperty({ type: [WorkflowStepApprovalLevelDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepApprovalLevelDto)
  levels: WorkflowStepApprovalLevelDto[];
}