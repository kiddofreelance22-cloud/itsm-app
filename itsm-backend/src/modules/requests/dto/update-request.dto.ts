import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

class UpdateRequestVariableValueDto {
  @ApiProperty({ example: 4 })
  @IsInt()
  variableId: number;

  @ApiProperty({ example: "MacBook Pro 14 inch" })
  @IsString()
  value: string;
}

export class UpdateRequestDto {
  @ApiProperty({ type: [UpdateRequestVariableValueDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateRequestVariableValueDto)
  variableValues: UpdateRequestVariableValueDto[];

  @ApiPropertyOptional({ example: "Corrected the requested model" })
  @IsOptional()
  @IsString()
  comments?: string;
}
