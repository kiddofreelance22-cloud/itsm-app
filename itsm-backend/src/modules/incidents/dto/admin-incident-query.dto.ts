import { Transform, Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

const INCIDENT_STATUSES = ["Open", "Assigned", "In Progress", "On Hold", "Resolved", "Closed"] as const;
const INCIDENT_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
const INCIDENT_LEVELS = ["Low", "Medium", "High"] as const;

export class AdminIncidentQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(INCIDENT_STATUSES) status?: typeof INCIDENT_STATUSES[number];
  @IsOptional() @IsIn(INCIDENT_PRIORITIES) priority?: typeof INCIDENT_PRIORITIES[number];
  @IsOptional() @IsIn(INCIDENT_LEVELS) impact?: typeof INCIDENT_LEVELS[number];
  @IsOptional() @IsIn(INCIDENT_LEVELS) urgency?: typeof INCIDENT_LEVELS[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) categoryId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) subCategoryId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) assignmentGroupId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) assignedToId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) createdById?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) locationId?: number;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
  @IsOptional() @Transform(({ value }) => value === "true" || value === true) slaBreached?: boolean;
}
