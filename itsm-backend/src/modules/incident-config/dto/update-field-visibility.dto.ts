import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

export class FieldVisibilityItemDto {
  @IsString() @MaxLength(100) field_name!: string;
  @IsString() @MaxLength(50) section!: string;
  @IsBoolean() visible!: boolean;
  @IsOptional() @IsBoolean() required?: boolean;
}

export class UpdateFieldVisibilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldVisibilityItemDto)
  fields!: FieldVisibilityItemDto[];
}