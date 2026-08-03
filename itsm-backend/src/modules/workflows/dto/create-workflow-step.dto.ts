import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString } from "class-validator";

export class CreateWorkflowStepDto {
  @ApiProperty({ example: "Manager Approval" })
  @IsString()
  stepName: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  stepOrder: number;

  @ApiProperty({ example: "approval", enum: ["approval", "task", "notification"] })
  @IsIn(["approval", "task", "notification"])
  stepType: "approval" | "task" | "notification";

  @ApiPropertyOptional({
    example: 2,
    description: "roleId required to act on this step (for approval/task steps)",
  })
  @IsOptional()
  @IsInt()
  approverRoleId?: number;
}
