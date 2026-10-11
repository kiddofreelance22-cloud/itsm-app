import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from "class-validator";
export class CreateImpactDto {
  @ApiProperty() @IsString() @MaxLength(100) impactName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) impactCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) color?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateImpactDto extends PartialType(CreateImpactDto) {}
