import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsOptional, IsString, ValidateNested } from "class-validator";

export class WorkflowStepTaskDto {
  @IsString() taskName!: string;
  @IsOptional() @IsString() description?: string;
  @IsIn(["user", "group", "role"]) assigneeType!: "user" | "group" | "role";
  @IsOptional() @IsInt() assigneeId?: number;
  @IsOptional() @IsInt() dueDateHours?: number;
  @IsOptional() @IsIn(["low", "medium", "high", "critical"]) priority?: "low" | "medium" | "high" | "critical";
}

export class ReplaceWorkflowStepTasksDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => WorkflowStepTaskDto) tasks!: WorkflowStepTaskDto[];
}
