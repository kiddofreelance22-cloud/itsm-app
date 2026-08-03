import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { CreateVariableOptionDto } from "./create-variable-option.dto";

const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "dropdown",
  "checkbox",
  "radio",
] as const;

export class CreateCatalogVariableDto {
  @ApiProperty({ example: "Laptop Model" })
  @IsString()
  label: string;

  @ApiProperty({ example: "dropdown", enum: FIELD_TYPES })
  @IsIn(FIELD_TYPES)
  fieldType: (typeof FIELD_TYPES)[number];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({
    type: [CreateVariableOptionDto],
    description: "Required for dropdown/checkbox/radio field types",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariableOptionDto)
  options?: CreateVariableOptionDto[];
}
