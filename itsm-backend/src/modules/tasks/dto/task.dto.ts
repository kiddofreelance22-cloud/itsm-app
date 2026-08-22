import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString } from "class-validator";

export class CreateTaskDto {
  @ApiProperty() @IsString() shortDescription: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ enum: ["Investigation","Implementation","Review","Approval","Other"] })
  @IsOptional() @IsIn(["Investigation","Implementation","Review","Approval","Other"]) taskType?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() assignedToId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() incidentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dueDate?: string;
}
export class UpdateTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsString() shortDescription?: string;
  @ApiPropertyOptional({ enum: ["Open","In Progress","Completed","Cancelled"] })
  @IsOptional() @IsIn(["Open","In Progress","Completed","Cancelled"]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() assignedToId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() dueDate?: string;
}
