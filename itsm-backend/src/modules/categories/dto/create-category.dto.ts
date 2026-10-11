import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, Matches } from "class-validator";

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

  @ApiPropertyOptional({ example: 3, description: "Omit/null to create a root category" })
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

  @ApiPropertyOptional({
    example: 5,
    description: "Assignment group incidents in this category (or its descendants, if they don't override it) should route to. Omit to inherit from the parent.",
  })
  @IsOptional()
  @IsInt()
  defaultAssignmentGroupId?: number;

  // ── Optional scope overrides ─────────────────────────────────────────────
  @ApiPropertyOptional({
    type: [Number],
    description: "Restrict this node to specific assignment groups (workgroups). Omit to inherit from the parent.",
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  workgroupIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    description: "Restrict this node to specific locations. Omit to inherit from the parent.",
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  locationIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    description: "Restrict this node to specific individual users. Omit to inherit from the parent.",
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  memberIds?: number[];
}
