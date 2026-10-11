import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { CreateWorkflowStepDto } from "./create-workflow-step.dto";

const WORKFLOW_STATUSES = ["draft", "active", "inactive"] as const;

export class CreateWorkflowDto {
  @ApiProperty({ example: "Laptop Request Approval" })
  @IsString()
  workflowName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: "draft", enum: WORKFLOW_STATUSES })
  @IsOptional()
  @IsIn(WORKFLOW_STATUSES)
  status?: (typeof WORKFLOW_STATUSES)[number];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  version?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  associatedCatalogId?: number;

  @ApiPropertyOptional({
    type: [CreateWorkflowStepDto],
    description: "Optionally create steps inline along with the workflow",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  steps?: CreateWorkflowStepDto[];

  @ApiPropertyOptional({
    default: false,
    description: "When true, a request must be approved as a whole (by approverRoleId) before its first step runs.",
  })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({
    example: 3,
    description: "roleId that must approve the request before the workflow's first step runs (required when requiresApproval is true)",
  })
  @IsOptional()
  @IsInt()
  approverRoleId?: number;
}

