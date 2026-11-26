import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export const LINK_TYPES = ["request", "incident", "change", "problem", "work_order"] as const;
export const LINK_RELATIONS = ["Related to", "Parent of", "Child of", "Caused by", "Cause of", "Duplicate of", "Duplicated by"] as const;

export class AttachLinkDto {
  @IsIn(LINK_TYPES as unknown as string[]) type!: (typeof LINK_TYPES)[number];
  @IsString() @MinLength(2) @MaxLength(60) targetNumber!: string;
  @IsOptional() @IsIn(LINK_RELATIONS as unknown as string[]) relation?: (typeof LINK_RELATIONS)[number];
}
export class UpdateLinkDto {
  @IsIn(LINK_RELATIONS as unknown as string[]) relation!: (typeof LINK_RELATIONS)[number];
}
export class CreateRelatedDto {
  @IsIn(LINK_TYPES as unknown as string[]) type!: (typeof LINK_TYPES)[number];
  @IsString() @MinLength(3) @MaxLength(250) shortDescription!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsIn(LINK_RELATIONS as unknown as string[]) relation?: (typeof LINK_RELATIONS)[number];
  @IsOptional() @IsString() @MaxLength(40) priority?: string;
  @IsOptional() @IsInt() priorityId?: number;
  @IsOptional() @IsIn(["Standard", "Normal", "Emergency"]) changeType?: "Standard" | "Normal" | "Emergency";
  @IsOptional() @IsString() @MaxLength(20) plannedDate?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsInt() catalogId?: number;
  @IsOptional() @IsBoolean() convert?: boolean;
}
export class WorkNoteDto {
  @IsString() @MinLength(1) @MaxLength(4000) text!: string;
}
export class LinkCandidatesQueryDto {
  @IsIn(LINK_TYPES as unknown as string[]) type!: (typeof LINK_TYPES)[number];
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsIn(["any", "open", "closed"]) state?: "any" | "open" | "closed";
  @IsOptional() @IsIn(["any", "me"]) raisedBy?: "any" | "me";
  @IsOptional() @IsIn(["any", "1", "7", "30", "90"]) raised?: "any" | "1" | "7" | "30" | "90";
  @IsOptional() @IsIn(["none", "requester", "group"]) match?: "none" | "requester" | "group";
  @IsOptional() @IsIn(["newest", "oldest", "number"]) sort?: "newest" | "oldest" | "number";
}
