import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateStatusDto {
  @ApiProperty({ example: "In Progress" }) @IsString() @MaxLength(100) statusName: string;
  @ApiProperty({ example: "IN_PROGRESS" }) @IsString() @MaxLength(50) statusCode: string;
  @ApiPropertyOptional({ example: "incident", enum: ["incident", "request", "change", "problem"] })
  @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isOpen?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateStatusDto extends PartialType(CreateStatusDto) {}
