import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateSubCategoryDto {
  @ApiProperty() @IsString() @MaxLength(150) subCategoryName: string;
  @ApiProperty() @IsString() @MaxLength(50) subCategoryCode: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() categoryId?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateSubCategoryDto extends PartialType(CreateSubCategoryDto) {}
