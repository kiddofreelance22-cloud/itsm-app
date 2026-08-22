import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";
export class CreatePriorityDto {
  @ApiProperty() @IsString() @MaxLength(100) priorityName: string;
  @ApiProperty() @IsString() @MaxLength(50) priorityCode: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
  @ApiPropertyOptional({ description: "Minutes to first response before SLA is breached", example: 30 })
  @IsOptional() @IsInt() @IsPositive() responseSlaMinutes?: number;
  @ApiPropertyOptional({ description: "Minutes to resolution before SLA is breached", example: 480 })
  @IsOptional() @IsInt() @IsPositive() resolutionSlaMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdatePriorityDto extends PartialType(CreatePriorityDto) {}
