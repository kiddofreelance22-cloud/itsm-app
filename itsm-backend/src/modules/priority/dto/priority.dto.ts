import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from "class-validator";
export class CreatePriorityDto {
  @ApiProperty() @IsString() @MaxLength(100) priorityName: string;
  @ApiProperty() @IsString() @MaxLength(50) priorityCode: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdatePriorityDto extends PartialType(CreatePriorityDto) {}
