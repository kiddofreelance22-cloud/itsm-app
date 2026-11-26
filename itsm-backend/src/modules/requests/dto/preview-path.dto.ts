import { Type } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from "class-validator";

class PreviewValueDto {
  @IsInt() variableId!: number;
  @IsString() value!: string;
}

export class PreviewPathDto {
  @IsInt() catalogId!: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PreviewValueDto)
  variableValues?: PreviewValueDto[];
}
