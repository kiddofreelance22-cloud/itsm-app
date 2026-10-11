import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsInt } from "class-validator";

export class CreateVariableOptionDto {
  @ApiProperty({ example: "MacBook Pro 14\"" })
  @IsString()
  optionLabel: string;

  @ApiProperty({ example: "macbook_pro_14" })
  @IsString()
  optionValue: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
