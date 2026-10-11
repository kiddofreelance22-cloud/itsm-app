import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class WorkflowTransitionInputDto {
  @ApiProperty({ enum: ["yes", "no"] })
  @IsIn(["yes", "no"])
  branch!: "yes" | "no";

  @ApiProperty()
  @IsInt()
  targetStepId!: number;
}

export class UpdateWorkflowTransitionsDto {
  @ApiProperty({ type: [WorkflowTransitionInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowTransitionInputDto)
  transitions!: WorkflowTransitionInputDto[];
}