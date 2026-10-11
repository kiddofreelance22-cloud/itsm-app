import { PartialType } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateServiceImpactDto {
  @IsString() @MaxLength(100) impactName!: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateServiceImpactDto extends PartialType(CreateServiceImpactDto) {}