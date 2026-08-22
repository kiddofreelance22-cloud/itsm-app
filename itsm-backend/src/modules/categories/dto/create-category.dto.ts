import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, Min, Matches } from "class-validator";

export class CreateCategoryDto {
  @ApiProperty({ example: "Hardware" })
  @IsString()
  categoryName!: string;

  @ApiPropertyOptional({ example: "CAT_HARD", description: "Auto-generated if omitted" })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_]+$/, { message: "Category code must be uppercase letters, numbers and underscores only" })
  categoryCode?: string;

  @ApiPropertyOptional({ example: "Hardware related requests" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  parentCategoryId?: number;

  @ApiPropertyOptional({ example: 1, description: "Display order (lower = first)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: "Monitor", description: "Lucide icon name" })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  availableInPortal?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  availableInMobile?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  showInCatalog?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowInIncident?: boolean;
}
