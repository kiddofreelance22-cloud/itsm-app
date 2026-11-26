import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { CreateVariableOptionDto } from "./create-variable-option.dto";

// All 13 types from the reference design's variable palette.
export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "datetime",
  "dropdown",
  "multi_select",
  "checkbox",
  "radio",
  "attachment",
  "user_lookup",
  "group_lookup",
  "info",
] as const;

export class CreateCatalogVariableDto {
  @ApiProperty({ example: "Laptop Model" })
  @IsString()
  label: string;

  @ApiProperty({ example: "dropdown", enum: FIELD_TYPES })
  @IsIn(FIELD_TYPES)
  fieldType: (typeof FIELD_TYPES)[number];

  @ApiPropertyOptional() @IsOptional() @IsInt() sectionId?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() placeholder?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() helpText?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isVisible?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() readOnly?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  // number
  @ApiPropertyOptional() @IsOptional() @IsString() minValue?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() maxValue?: string;

  // text / textarea
  @ApiPropertyOptional() @IsOptional() @IsString() validationRegex?: string;

  // date / datetime — ISO date strings ("YYYY-MM-DD")
  @ApiPropertyOptional() @IsOptional() @IsString() dateMin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateMax?: string;

  // attachment
  @ApiPropertyOptional({ description: "Comma-separated extensions, e.g. \".pdf,.png\"" })
  @IsOptional() @IsString() allowedFileTypes?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() maxFileSizeMb?: number;

  // user_lookup / group_lookup
  @ApiPropertyOptional() @IsOptional() @IsString() lookupSource?: string;

  // Form builder enhancements
  @ApiPropertyOptional({ default: "medium" })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() tooltipText?: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() onlyIntegers?: boolean;
  @ApiPropertyOptional({ description: "Longest text a requester may enter" }) @IsOptional() @IsInt() @Min(1) @Max(4000) maxLength?: number;
  @ApiPropertyOptional({ default: false, description: "Dates before today are refused" }) @IsOptional() @IsBoolean() noPastDates?: boolean;
  @ApiPropertyOptional({ default: "end_user" }) @IsOptional() @IsString() updateBy?: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isUnique?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() displayInEmail?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() autoPopulate?: boolean;

  @ApiPropertyOptional({
    type: [CreateVariableOptionDto],
    description: "Required for dropdown/multi_select/checkbox/radio field types",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariableOptionDto)
  options?: CreateVariableOptionDto[];
}
