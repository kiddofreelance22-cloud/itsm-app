import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, IsNumber, ValidateNested } from "class-validator";
import { WorkflowStepApprovalLevelDto } from "./workflow-step-approval-level.dto";

export class CreateWorkflowStepDto {
  @ApiProperty({ example: "Manager Approval" })
  @IsString()
  stepName: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  stepOrder: number;

  @ApiProperty({ example: "approval", enum: ["approval", "task", "notification", "condition", "wait", "subflow", "update"] })
  @IsIn(["approval", "task", "notification", "condition", "wait", "subflow", "update", "record", "integration"])
  stepType: "approval" | "task" | "notification" | "condition" | "wait" | "subflow" | "update" | "record" | "integration";

  @ApiPropertyOptional({
    example: 2,
    description: "roleId required to act on this step (for approval/task steps)",
  })
  @IsOptional()
  @IsInt()
  approverRoleId?: number;

  @ApiPropertyOptional({
    example: "httpRequest",
    description: "Visual node kind from the workflow editor's node palette (e.g. httpRequest, code, loop, cron). Falls back to stepType when omitted.",
  })
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
