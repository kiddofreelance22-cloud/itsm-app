import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, IsObject } from "class-validator";

export class CreateRoleDto {
  @ApiProperty({ example: "Approver" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  roleName: string;

  @ApiPropertyOptional({ example: "ROLE_APPROVER" })
  @IsOptional()
  @IsString()
  roleCode?: string;

  @ApiPropertyOptional({ example: "Can approve catalog requests" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: { requests: { read: true, create: true } } })
  @IsOptional()
  @IsObject()
  permissions?: Record<string, any>;
}
