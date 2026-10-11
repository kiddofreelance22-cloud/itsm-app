import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, IsObject, Min } from "class-validator";

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

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: { requests: { read: true, create: true } } })
  @IsOptional()
  @IsObject()
  permissions?: Record<string, any>;
}
