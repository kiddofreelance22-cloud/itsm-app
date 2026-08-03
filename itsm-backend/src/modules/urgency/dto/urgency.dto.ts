import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from "class-validator";
export class CreateUrgencyDto {
  @ApiProperty() @IsString() @MaxLength(100) urgencyName: string;
  @ApiProperty() @IsString() @MaxLength(50) urgencyCode: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateUrgencyDto extends PartialType(CreateUrgencyDto) {}
