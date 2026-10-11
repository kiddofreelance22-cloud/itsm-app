import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsObject } from "class-validator";

export class CreateWorkflowTaskDto {
  @ApiProperty()
  @IsInt()
  activityId: number;

  @ApiProperty()
  @IsString()
  taskName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  assigneeType: string; // user, group, role

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  assigneeId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  dueDateHours?: number;

  @ApiPropertyOptional({ default: "medium" })
  @IsOptional()
  @IsString()
  priority?: string; // low, medium, high, critical

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  checklists?: Record<string, unknown>;
}
