import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString } from "class-validator";

export class CreateProblemDto {
  @ApiProperty() @IsString() shortDescription: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() assignedToId?: number;
}
export class UpdateProblemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() shortDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ enum: ["Open", "In Progress", "Resolved", "Closed"] })
  @IsOptional() @IsIn(["Open", "In Progress", "Resolved", "Closed"]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() assignedToId?: number;
}
