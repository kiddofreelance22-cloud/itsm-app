import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt,
  IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength,
} from "class-validator";

export class CreateCsmCustomerDto {
  @IsIn(["B2B", "B2C"]) customerType!: "B2B" | "B2C";
  @IsString() @MinLength(2) @MaxLength(200) name!: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) industry?: string;
  @IsOptional() @IsString() @MaxLength(80) accountType?: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string;
  @IsOptional() @IsString() @MaxLength(300) website?: string;
  @IsOptional() @IsInt() parentCustomerId?: number;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsString() @MaxLength(100) segment?: string;
  @IsOptional() @IsString() @MaxLength(50) preferredChannel?: string;
}

export class UpdateCsmCustomerDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) name?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) industry?: string;
  @IsOptional() @IsString() @MaxLength(80) accountType?: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string;
  @IsOptional() @IsString() @MaxLength(300) website?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsString() @MaxLength(100) segment?: string;
  @IsOptional() @IsString() @MaxLength(50) preferredChannel?: string;
  @IsOptional() @IsIn(["Active", "Inactive"]) status?: string;
}

export class CreateCsmContactDto {
  @IsString() @MinLength(2) @MaxLength(150) fullName!: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class UpdateCsmContactDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) fullName?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsIn(["Active", "Inactive"]) status?: string;
}

export class CreateCsmCaseDto {
  @IsInt() customerId!: number;
  @IsOptional() @IsString() @MaxLength(150) customerContact?: string;
  @IsOptional() @IsEmail() @MaxLength(254) contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @IsIn(["Issue", "Request", "Complaint"]) caseType!: "Issue" | "Request" | "Complaint";
  @IsString() @MinLength(1) @MaxLength(120) category!: string;
  @IsOptional() @IsString() @MaxLength(120) subcategory?: string;
  @IsOptional() @IsString() @MaxLength(160) productService?: string;
  @IsString() @MinLength(3) @MaxLength(300) shortDescription!: string;
  @IsString() @MinLength(1) @MaxLength(4000) description!: string;
  @IsOptional() @IsIn(["Low", "Medium", "High", "Critical"]) priority?: string;
  @IsOptional() @IsString() @MaxLength(40) impact?: string;
  @IsOptional() @IsIn(["Low", "Medium", "High"]) urgency?: string;
  @IsOptional() @IsIn(["Agent", "Customer Portal", "Email", "Phone", "Chat", "Social Media"]) source?: string;
  @IsOptional() @IsInt() assignmentGroupId?: number;
  @IsOptional() @IsInt() assignedTo?: number;
  @IsOptional() @IsInt() slaId?: number;
  @IsOptional() @IsObject() issueDetails?: Record<string, unknown>;
}

export class UpdateCsmCaseDto {
  @IsOptional() @IsIn(["Issue", "Request", "Complaint"]) caseType?: string;
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsString() @MaxLength(120) subcategory?: string;
  @IsOptional() @IsString() @MaxLength(160) productService?: string;
  @IsOptional() @IsString() @MaxLength(300) shortDescription?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsIn(["Low", "Medium", "High", "Critical"]) priority?: string;
  @IsOptional() @IsString() @MaxLength(40) impact?: string;
  @IsOptional() @IsIn(["Low", "Medium", "High"]) urgency?: string;
  @IsOptional() @IsIn(["New", "Open", "Assigned", "In Progress", "Pending Customer", "Resolved", "Closed"]) status?: string;
  @IsOptional() @IsInt() assignmentGroupId?: number | null;
  @IsOptional() @IsInt() assignedTo?: number | null;
  @IsOptional() @IsInt() slaId?: number | null;
  @IsOptional() @IsObject() issueDetails?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(100) resolutionCode?: string;
  @IsOptional() @IsString() @MaxLength(4000) resolutionSummary?: string;
  @IsOptional() @IsString() @MaxLength(4000) closureNotes?: string;
}

export class CreateCsmActivityDto {
  @IsIn(["Work Log", "Internal Note", "Customer Update"]) activityType!: "Work Log" | "Internal Note" | "Customer Update";
  @IsString() @MinLength(1) @MaxLength(4000) content!: string;
}

export class CreateCsmContractDto {
  @IsInt() customerId!: number;
  @IsString() @MinLength(2) @MaxLength(200) contractName!: string;
  @IsOptional() @IsString() @MaxLength(80) contractType?: string;
  @IsOptional() @IsString() @MaxLength(150) ownerName?: string;
  @IsOptional() @IsIn(["Draft", "Active"]) status?: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsBoolean() autoRenew?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) services?: string[];
  @IsOptional() @IsObject() commercialTerms?: Record<string, unknown>;
}

export class UpdateCsmContractDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) contractName?: string;
  @IsOptional() @IsString() @MaxLength(80) contractType?: string;
  @IsOptional() @IsString() @MaxLength(150) ownerName?: string;
  @IsOptional() @IsIn(["Draft", "Active", "Expired", "Terminated"]) status?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() autoRenew?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) services?: string[];
  @IsOptional() @IsObject() commercialTerms?: Record<string, unknown>;
}

export class RenewCsmContractDto {
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
}

export class CreateCsmSlaDto {
  @IsString() @MinLength(2) @MaxLength(200) slaName!: string;
  @IsOptional() @IsString() @MaxLength(80) slaType?: string;
  @IsString() @MinLength(2) @MaxLength(160) service!: string;
  @IsOptional() @IsInt() contractId?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) appliesTo?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsString({ each: true }) priorities?: string[];
  @IsInt() @Min(1) @Max(525600) responseMinutes!: number;
  @IsInt() @Min(1) @Max(525600) resolutionMinutes!: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) availabilityPercent?: number;
  @IsOptional() @IsObject() escalationPolicy?: Record<string, unknown>;
  @IsOptional() @IsIn(["Draft", "Active", "Inactive"]) status?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}

export class UpdateCsmSlaDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) slaName?: string;
  @IsOptional() @IsString() @MaxLength(80) slaType?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) service?: string;
  @IsOptional() @IsInt() contractId?: number | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) appliesTo?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsString({ each: true }) priorities?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(525600) responseMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(525600) resolutionMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) availabilityPercent?: number | null;
  @IsOptional() @IsObject() escalationPolicy?: Record<string, unknown>;
  @IsOptional() @IsIn(["Draft", "Active", "Inactive"]) status?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}

export class CreateCsmEscalationDto {
  @IsInt() caseId!: number;
  @IsString() @MinLength(2) @MaxLength(50) escalationType!: string;
  @IsString() @MinLength(2) @MaxLength(50) level!: string;
  @IsIn(["Low", "Medium", "High", "Critical"]) priority!: string;
  @IsOptional() @IsInt() targetGroupId?: number;
  @IsOptional() @IsInt() targetUserId?: number;
  @IsDateString() dueBy!: string;
  @IsString() @MinLength(2) @MaxLength(2000) reason!: string;
  @IsOptional() @IsString() @MaxLength(2000) comments?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) recipients?: string[];
  @IsOptional() @IsBoolean() sendImmediateNotification?: boolean;
}

export class CreateCsmMajorCaseDto {
  @IsString() @MinLength(3) @MaxLength(250) title!: string;
  @IsString() @MinLength(3) @MaxLength(4000) description!: string;
  @IsString() @MinLength(2) @MaxLength(160) productService!: string;
  @IsString() @MinLength(2) @MaxLength(80) majorCaseType!: string;
  @IsIn(["Low", "Medium", "High", "Critical"]) severity!: string;
  @IsString() @MinLength(2) @MaxLength(40) businessImpact!: string;
  @IsString() @MinLength(2) @MaxLength(80) impactType!: string;
  @IsOptional() @IsString() @MaxLength(200) estimatedImpact?: string;
  @IsOptional() @IsInt() ownerId?: number;
  @IsOptional() @IsInt() incidentCommanderId?: number;
  @IsOptional() @IsInt() resolverGroupId?: number;
  @IsOptional() @IsInt() coordinationGroupId?: number;
  @IsOptional() @IsIn(["In Coordination", "In Progress", "Monitoring"]) status?: string;
  @IsDateString() incidentStart!: string;
  @IsDateString() targetRestoration!: string;
  @IsOptional() @IsBoolean() notifyCustomers?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) communicationChannels?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsInt({ each: true }) relatedCaseIds?: number[];
}

export class UpdateCsmMajorCaseDto {
  @IsIn(["In Coordination", "In Progress", "Monitoring", "Resolved", "Closed"]) status!: string;
  @IsOptional() @IsString() @MaxLength(4000) update?: string;
}

export class CreateCsmViewDto {
  @IsString() @MinLength(2) @MaxLength(120) viewName!: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsObject() filters!: Record<string, unknown>;
  @IsOptional() @IsBoolean() isShared?: boolean;
}
