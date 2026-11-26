import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";

export class CreateServicePriorityDto {
  @ApiProperty() @IsString() @MaxLength(100) priorityName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) priorityCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
  @ApiPropertyOptional({ description: "Minutes to first response before the SLA is breached", example: 30 })
  @IsOptional() @IsInt() @IsPositive() responseSlaMinutes?: number | null;
  @ApiPropertyOptional({ description: "Minutes to fulfilment before the SLA is breached", example: 480 })
  @IsOptional() @IsInt() @IsPositive() resolutionSlaMinutes?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) color?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateServicePriorityDto extends PartialType(CreateServicePriorityDto) {}
