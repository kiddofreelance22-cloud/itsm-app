import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateAssignmentGroupDto {
  @ApiProperty() @IsString() @MaxLength(150) groupName!: string;
  @ApiProperty() @IsString() @MaxLength(50) groupCode!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() managerId?: number;
  @ApiPropertyOptional({ type: [Number] }) @IsOptional() @IsArray() memberIds?: number[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateAssignmentGroupDto extends PartialType(CreateAssignmentGroupDto) {}
