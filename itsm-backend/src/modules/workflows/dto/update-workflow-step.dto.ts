import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsInt, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { WorkflowStepApprovalLevelDto } from "./workflow-step-approval-level.dto";

export class UpdateWorkflowStepDto {
  @ApiPropertyOptional({ example: "Manager Approval" })
  @IsOptional()
  @IsString()
  stepName?: string;

  @ApiPropertyOptional({ example: "Requested access level equals admin" })
  @IsOptional()
  @IsString()
  conditionExpression?: string;

  @IsOptional()
  @IsInt()
  approverRoleId?: number | null;

  @ApiPropertyOptional({ example: "httpRequest" })
  @IsOptional()
  @IsString()
  nodeKind?: string;

  @ApiPropertyOptional({ description: "Per-node-kind configuration (URL/method, script, query, cron expression, etc.)" })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Canvas X position" })
  @IsOptional()
  @IsNumber()
  positionX?: number;

  @ApiPropertyOptional({ description: "Canvas Y position" })
  @IsOptional()
  @IsNumber()
  positionY?: number;

  @ApiPropertyOptional({ type: [WorkflowStepApprovalLevelDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepApprovalLevelDto)
  approvalLevels?: WorkflowStepApprovalLevelDto[];
}
