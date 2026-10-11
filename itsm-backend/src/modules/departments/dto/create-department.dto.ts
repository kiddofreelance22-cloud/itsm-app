import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class CreateDepartmentDto {
  @ApiProperty({ example: "Information Technology" })
  @IsString()
  departmentName: string;

  @ApiPropertyOptional({ example: "IT", description: "Generated from the name when omitted" })
  @IsOptional()
  @IsString()
  departmentCode?: string;

  @ApiPropertyOptional({ example: "IT department for technical support and infrastructure" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  availableInPortal?: boolean;
}
