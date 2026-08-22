import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString } from "class-validator";

export class CreateChangeDto {
  @ApiProperty() @IsString() shortDescription: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() assignedToId?: number;
}
export class UpdateChangeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() shortDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ enum: ["Open", "In Progress", "Completed", "Cancelled"] })
  @IsOptional() @IsIn(["Open", "In Progress", "Completed", "Cancelled"]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() assignedToId?: number;
}
