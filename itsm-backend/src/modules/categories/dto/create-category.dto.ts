import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString } from "class-validator";

export class CreateCategoryDto {
  @ApiProperty({ example: "Hardware" })
  @IsString()
  categoryName: string;

  @ApiPropertyOptional({ example: "Laptops, monitors, peripherals" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 3,
    description: "categoryId of the parent category, for sub-categories",
  })
  @IsOptional()
  @IsInt()
  parentCategoryId?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
