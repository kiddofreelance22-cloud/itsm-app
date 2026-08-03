import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString } from "class-validator";

const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

export class CreateIncidentDto {
  @ApiProperty({ example: "Laptop won't power on" })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: "Tried a different charger, still no response." })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ example: "Medium", enum: PRIORITIES, default: "Medium" })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: (typeof PRIORITIES)[number];

  @ApiPropertyOptional({
    example: 12,
    description: "Optional link back to the originating service request",
  })
  @IsOptional()
  @IsInt()
  requestId?: number;
}
