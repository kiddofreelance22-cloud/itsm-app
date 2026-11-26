import { PartialType } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateRequestPendingReasonDto {
  @IsString() @MaxLength(100) pendingReasonName!: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @IsOptional() @IsIn(["pause", "continue"]) slaImpact?: "pause" | "continue";
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateRequestPendingReasonDto extends PartialType(CreateRequestPendingReasonDto) {}
