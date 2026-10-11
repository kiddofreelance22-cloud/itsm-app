import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateNested,
} from "class-validator";

// ── Simple ordered masters (checklists, WO checklist, on-hold reasons, resolution codes) ──
export class MasterItemDto {
  @ApiPropertyOptional() @IsString() @IsNotEmpty() @MaxLength(150) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ enum: ["pause", "continue"] }) @IsOptional() @IsIn(["pause", "continue"]) slaImpact?: "pause" | "continue";
}
export class UpdateMasterItemDto extends PartialType(MasterItemDto) {}

// ── Checklist templates: visibility scope + task rows ──
export const CHECKLIST_TASK_STATUSES = ["Not Applicable", "Mandatory", "Optional"];
export class ChecklistTaskDto {
  @IsString() @IsNotEmpty() @MaxLength(250) taskName!: string;
  @IsOptional() @IsIn(CHECKLIST_TASK_STATUSES) taskStatus?: string;
  @IsOptional() @IsString() @MaxLength(500) remarks?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class ChecklistTemplateDto extends MasterItemDto {
  @ApiPropertyOptional({ description: "Workgroup the checklist is visible to; null/omitted = all workgroups" }) @IsOptional() @IsInt() groupId?: number | null;
  @ApiPropertyOptional({ description: "Incident status the checklist is shown in; null/omitted = any status" }) @IsOptional() @IsString() @MaxLength(100) statusName?: string | null;
  @ApiPropertyOptional({ description: "Category the checklist applies to; null/omitted = any category" }) @IsOptional() @IsInt() categoryId?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() includeSubCategories?: boolean;
  @ApiPropertyOptional({ type: [ChecklistTaskDto] }) @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ChecklistTaskDto) tasks?: ChecklistTaskDto[];
}
export class UpdateChecklistTemplateDto extends PartialType(ChecklistTemplateDto) {}

// ── Classification tree ──
export class ClassificationDto {
  @ApiPropertyOptional() @IsString() @IsNotEmpty() @MaxLength(150) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() parentId?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateClassificationDto extends PartialType(ClassificationDto) {}

// ── Status transitions ──
export class SetTransitionsDto {
  @ApiPropertyOptional({ type: [String] }) @IsArray() @IsString({ each: true }) allowedTo!: string[];
}

// ── Mandatory field rules / Approval rules (saved as a whole, like the "Save Rules" button) ──
export class MandatoryRuleItemDto {
  // Fields the GET endpoint returns; the UI echoes them back on save. Accepted and ignored (the server re-numbers rules).
  @IsOptional() @IsInt() ruleId?: number;
  @IsOptional() @IsInt() displayOrder?: number;
  @IsOptional() createdAt?: string | Date;
  @IsOptional() updatedAt?: string | Date;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsString() @IsNotEmpty() conditionField!: string;
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) conditionValues!: string[];
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) targetFields!: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class SaveMandatoryRulesDto {
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => MandatoryRuleItemDto)
  rules!: MandatoryRuleItemDto[];
}
export class ApprovalRuleItemDto {
  @IsOptional() @IsInt() ruleId?: number;
  @IsOptional() @IsInt() displayOrder?: number;
  @IsOptional() createdAt?: string | Date;
  @IsOptional() updatedAt?: string | Date;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsIn(["Resolve", "Close", "Reopen"]) action!: "Resolve" | "Close" | "Reopen";
  @IsString() @IsNotEmpty() approvalType!: string;
  @IsString() @IsNotEmpty() conditionField!: string;
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) conditionValues!: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class SaveApprovalRulesDto {
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ApprovalRuleItemDto)
  rules!: ApprovalRuleItemDto[];
}

// ── Notification rules ──
export const TRIGGER_EVENTS = [
  "created", "assigned", "pendingCustomer", "onHold", "resolved", "closed", "reopened", "slaBreachWarning", "approvalRequested",
];
export const RECIPIENT_KEYS = ["reporter", "assignedAgent", "workgroup", "approver", "watchers"];
export class NotificationRuleDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) triggerEvent!: string;
  @IsArray() @IsIn(RECIPIENT_KEYS, { each: true }) recipients!: string[];
  @IsString() @IsNotEmpty() @MaxLength(300) subject!: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsIn(["text", "html"]) bodyFormat?: "text" | "html";
  @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateNotificationRuleDto extends PartialType(NotificationRuleDto) {}

// ── Incident approvals ──
export class ApprovalDecisionDto {
  @IsOptional() @IsString() note?: string;
}
export class RequestApprovalDto {
  @IsString() @IsNotEmpty() incidentId!: string;
  @IsIn(["Resolve", "Close", "Reopen"]) action!: "Resolve" | "Close" | "Reopen";
  @IsOptional() @IsString() comments?: string;
}

// ── Feedback moderation ──
export class ModerateFeedbackDto {
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsBoolean() flagged?: boolean;
}

// ── Work orders ──
export const WO_STATUSES = ["Open", "In Progress", "On Hold", "Completed", "Cancelled"];
export const WO_PRIORITIES = ["P1 - Critical", "P2 - High", "P3 - Medium", "P4 - Low"];
export class WorkOrderDto {
  @IsOptional() @IsString() incidentId?: string | null;
  @IsString() @IsNotEmpty() @MaxLength(250) title!: string;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsInt() groupId?: number | null;
  @IsOptional() @IsInt() assignedTo?: number | null;
  @IsOptional() @IsIn(WO_PRIORITIES) priority?: string;
  @IsOptional() @IsIn(WO_STATUSES) status?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateWorkOrderDto extends PartialType(WorkOrderDto) {}

// ── SLA matrix / workgroup SLA window ──
export class SlaMatrixDto {
  @IsInt() groupId!: number;
  @IsInt() priorityId!: number;
  @IsInt() @Min(1) @Max(5256000) responseMinutes!: number;
  @IsInt() @Min(1) @Max(5256000) resolutionMinutes!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateSlaMatrixDto {
  @IsOptional() @IsInt() @Min(1) @Max(5256000) responseMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5256000) resolutionMinutes?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class WorkgroupSlaWindowDto {
  @IsOptional() @IsInt() slaServiceWindowId?: number | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ── Directory integration ──
export class DirectorySourceDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150) name?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() autoCreateUsers?: boolean;
  @IsOptional() @IsString() @MaxLength(300) ldapUrl?: string;
  @IsOptional() @IsString() @MaxLength(400) bindDn?: string;
  /** Blank / omitted = keep the stored password. */
  @IsOptional() @IsString() bindPassword?: string;
  @IsOptional() @IsString() @MaxLength(400) baseDn?: string;
  @IsOptional() @IsString() @MaxLength(400) searchFilter?: string;
  @IsOptional() @IsString() @MaxLength(40) defaultRole?: string;
  @IsOptional() @IsString() @MaxLength(150) tenantId?: string;
  @IsOptional() @IsString() @MaxLength(100) clientId?: string;
  /** Blank / omitted = keep the stored secret. */
  @IsOptional() @IsString() clientSecret?: string;
  @IsOptional() @IsString() @MaxLength(400) redirectUri?: string;
  @IsOptional() @IsBoolean() ssoEnabled?: boolean;
  @IsOptional() @IsBoolean() ssoOnly?: boolean;
  @IsOptional() @IsString() allowedDomains?: string;
}
export class CreateDirectorySourceDto extends DirectorySourceDto {
  @IsIn(["ldap", "azure_ad"]) type!: "ldap" | "azure_ad";
}
export class AttributeMappingRowDto {
  @IsOptional() @IsInt() mappingId?: number;
  @IsOptional() @IsInt() sourceId?: number;
  @IsString() @IsNotEmpty() @MaxLength(100) localField!: string;
  @IsString() @IsNotEmpty() @MaxLength(150) externalAttribute!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isCustom?: boolean;
  @IsOptional() @IsInt() displayOrder?: number;
}
export class SaveAttributeMappingsDto {
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => AttributeMappingRowDto)
  rows!: AttributeMappingRowDto[];
}
