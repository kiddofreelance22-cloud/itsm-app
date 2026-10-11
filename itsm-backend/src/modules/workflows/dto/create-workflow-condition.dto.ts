import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString } from "class-validator";

export class CreateWorkflowConditionDto {
  @ApiProperty()
  @IsInt()
  activityId: number;

  @ApiProperty()
  @IsString()
  conditionName: string;

  @ApiProperty()
  @IsString()
  expression: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  truePathActivityId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  falsePathActivityId?: number;
}
