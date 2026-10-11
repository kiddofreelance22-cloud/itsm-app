import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateStatusDto {
  @ApiProperty({ example: "In Progress" }) @IsString() @MaxLength(100) statusName: string;
  @ApiPropertyOptional({ example: "IN_PROGRESS", description: "Generated from the name when omitted" }) @IsOptional() @IsString() @MaxLength(50) statusCode?: string;
  @ApiPropertyOptional({ example: "incident", enum: ["incident", "request", "change", "problem"] })
  @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isOpen?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateStatusDto extends PartialType(CreateStatusDto) {}
