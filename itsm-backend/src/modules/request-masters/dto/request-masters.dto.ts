import { PartialType } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
export class CreateClosureCodeDto { @IsString() @MaxLength(100) closureCodeName!: string; @IsOptional() @IsString() description?: string | null; @IsOptional() @IsInt() @Min(0) displayOrder?: number; @IsOptional() @IsBoolean() isActive?: boolean; }
export class UpdateClosureCodeDto extends PartialType(CreateClosureCodeDto) {}
export class CreatePendingReasonDto { @IsString() @MaxLength(100) pendingReasonName!: string; @IsOptional() @IsString() description?: string | null; @IsOptional() @IsInt() @Min(0) displayOrder?: number; @IsOptional() @IsIn(["pause", "continue"]) slaImpact?: "pause" | "continue"; @IsOptional() @IsBoolean() isActive?: boolean; }
export class UpdatePendingReasonDto extends PartialType(CreatePendingReasonDto) {}
export class CreatePriorityMatrixDto { @IsInt() urgencyId!: number; @IsInt() impactId!: number; @IsInt() priorityId!: number; @IsOptional() @IsBoolean() isActive?: boolean; }
export class UpdatePriorityMatrixDto extends PartialType(CreatePriorityMatrixDto) {}
export class ServiceWindowDayDto { @IsInt() day!: number; @IsBoolean() enabled!: boolean; @IsString() from!: string; @IsString() to!: string; }
export class CreateSlaServiceWindowDto {
  @IsOptional() @IsString() description?: string | null; @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @IsString() @MaxLength(150) slaName!: string; @IsOptional() @IsString() holidayCalendarLocation?: string;
  @IsOptional() @IsBoolean() useAnalystWorkLocation?: boolean; @IsOptional() @IsString() timeZone?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean; @IsOptional() @IsBoolean() isActive?: boolean; @IsOptional() @IsBoolean() is24x7?: boolean;
  @IsOptional() serviceWindow!: ServiceWindowDayDto[] | string;
}
export class UpdateSlaServiceWindowDto extends PartialType(CreateSlaServiceWindowDto) {}