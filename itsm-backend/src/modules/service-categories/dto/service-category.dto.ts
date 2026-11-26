import { PartialType } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateServiceCategoryDto {
  @IsString() @MaxLength(150) categoryName!: string;
  @IsOptional() @IsInt() parentCategoryId?: number | null;
  @IsOptional() @IsString() @MaxLength(150) parentCategoryName?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @IsString() @MaxLength(20) tileColor?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateServiceCategoryDto extends PartialType(CreateServiceCategoryDto) {}