import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export const NOTIFICATION_EVENTS = ["submitted", "approvalRequested", "approved", "rejected", "assigned", "onHold", "fulfilled", "reopened", "closed", "cancelled", "slaWarning"] as const;
export const NOTIFICATION_RECIPIENTS = ["requester", "requestedFor", "approver", "assignedAgent", "workgroup", "watchers"] as const;
export const STATUS_COLORS = ["amber", "blue", "violet", "green", "red", "gray", "dark"] as const;

export class CreateRequestStatusDto {
  @IsString() @MinLength(1) @MaxLength(100) statusName!: string;
  @IsIn(["work", "hold"]) stage!: "work" | "hold";
  @IsOptional() @IsIn(STATUS_COLORS as unknown as string[]) color?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateRequestStatusDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) statusName?: string;
  @IsOptional() @IsIn(["work", "hold"]) stage?: "work" | "hold";
  @IsOptional() @IsIn(STATUS_COLORS as unknown as string[]) color?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateApproverGroupDto {
  @IsString() @MinLength(1) @MaxLength(150) groupName!: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsArray() @IsInt({ each: true }) memberIds!: number[];
}
export class UpdateApproverGroupDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) groupName?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @IsInt({ each: true }) memberIds?: number[];
}

export class CreateRequestPriorityMatrixDto {
  @IsInt() urgencyId!: number;
  @IsInt() serviceImpactId!: number;
  @IsInt() priorityId!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateRequestPriorityMatrixDto {
  @IsOptional() @IsInt() priorityId?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateNotificationRuleDto {
  @IsString() @MinLength(1) @MaxLength(150) ruleName!: string;
  @IsIn(NOTIFICATION_EVENTS as unknown as string[]) eventKey!: string;
  @IsArray() @IsIn(NOTIFICATION_RECIPIENTS as unknown as string[], { each: true }) recipients!: string[];
  @IsString() @MinLength(1) @MaxLength(250) subject!: string;
  @IsString() @MinLength(1) body!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() displayOrder?: number;
}
export class UpdateNotificationRuleDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) ruleName?: string;
  @IsOptional() @IsIn(NOTIFICATION_EVENTS as unknown as string[]) eventKey?: string;
  @IsOptional() @IsArray() @IsIn(NOTIFICATION_RECIPIENTS as unknown as string[], { each: true }) recipients?: string[];
  @IsOptional() @IsString() @MinLength(1) @MaxLength(250) subject?: string;
  @IsOptional() @IsString() @MinLength(1) body?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() displayOrder?: number;
}
