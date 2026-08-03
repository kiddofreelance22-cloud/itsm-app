import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateLocationDto {
  @ApiProperty() @IsString() @MaxLength(150) locationName: string;
  @ApiProperty() @IsString() @MaxLength(50) locationCode: string;
  @ApiPropertyOptional({ enum: ["Office", "Branch", "Remote", "Data Center", "Other"] })
  @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateLocationDto extends PartialType(CreateLocationDto) {}
