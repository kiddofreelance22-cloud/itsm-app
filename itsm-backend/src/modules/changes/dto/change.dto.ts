import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength,
} from "class-validator";


/** Fields shared by create and update — everything about the RFC itself. */
class ChangeFieldsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) shortDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() businessService?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) configurationItems?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() assignmentGroup?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() assignedToId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() impact?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() urgency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() justification?: string;
  /** Question id → chosen option index. The score and level are always computed on the server. */
  @ApiPropertyOptional() @IsOptional() @IsObject() riskAnswers?: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsDateString() plannedStart?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() plannedEnd?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() causesOutage?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() expectedOutage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() implementationPlan?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() backoutPlan?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() testPlan?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() communicationPlan?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() relatedRecords?: { kind: string; number: string; title?: string }[];
}

export class CreateChangeDto extends ChangeFieldsDto {
  @ApiProperty() @IsString() @MaxLength(255) declare shortDescription: string;
  @ApiPropertyOptional({ description: "Name of a change model, e.g. Standard, Normal, Emergency" }) @IsOptional() @IsString() changeType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() templateId?: string;
  /** true = send straight into assessment/approval; false/omitted = keep as a draft (state New). */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() submit?: boolean;
}

export class UpdateChangeDto extends ChangeFieldsDto {}

export class ChangeListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() risk?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() group?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  /** Planned window must overlap [from, to] — used by the change schedule. */
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}

export class ApprovalDecisionDto {
  @ApiProperty({ enum: ["Approved", "Rejected"] }) @IsIn(["Approved", "Rejected"]) decision!: "Approved" | "Rejected";
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}

export class CreateChangeTaskDto {
  @ApiProperty() @IsString() @MaxLength(255) shortDescription!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignmentGroup?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() assignedToId?: number;
}

export class UpdateChangeTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) shortDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignmentGroup?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() assignedToId?: number;
  @ApiPropertyOptional({ enum: ["Open", "In Progress", "Closed", "Cancelled"] })
  @IsOptional() @IsIn(["Open", "In Progress", "Closed", "Cancelled"]) state?: string;
}

export class WorkNoteDto {
  @ApiProperty() @IsString() note!: string;
}

export class CompleteImplementationDto {
  @ApiProperty({ enum: ["Successful", "Successful with issues", "Failed", "Backed out"] })
  @IsIn(["Successful", "Successful with issues", "Failed", "Backed out"]) outcome!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() actualEnd?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class SavePirDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() heldOn?: string;
  @ApiProperty({ enum: ["Yes", "Partially", "No"] }) @IsIn(["Yes", "Partially", "No"]) objectivesMet!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() attendees?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cause?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() actions?: string;
}

export class CloseChangeDto {
  @ApiProperty() @IsString() closeCode!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() closeNotes?: string;
}

/** Draft values for POST /changes/preview — type, risk answers, window, service and CIs. */
export class PreviewChangeDto extends ChangeFieldsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() changeType?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() changeId?: number;
}

export class CabDecisionDto {
  @ApiProperty() @IsInt() changeId!: number;
  @ApiProperty({ enum: ["Approved", "Rejected"] }) @IsIn(["Approved", "Rejected"]) decision!: "Approved" | "Rejected";
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}

export class CabAttendanceDto {
  @ApiProperty() @IsArray() attendance!: { name: string; role: string; present: boolean }[];
}

export class EndMeetingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() minutes?: string;
}

export class RequestInfoDto {
  @ApiProperty() @IsString() comment!: string;
}

export class SimulateDto {
  @ApiProperty() @IsString() changeType!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() risk?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  /** Sample attributes for lifecycle conditions (priority, outage, leadDays …). */
  @ApiPropertyOptional() @IsOptional() @IsObject() attrs?: Record<string, string | number>;
  /** Try this saved lifecycle for the model instead of the lifecycle the model uses. */
  @ApiPropertyOptional() @IsOptional() @IsString() lifecycleId?: string;
}
