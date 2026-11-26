import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { PartialType } from "@nestjs/swagger";

export const ARTICLE_TYPES = ["Standard KB", "Known Error", "Standard Change"] as const;
export const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;
export const ARTICLE_STATUSES = ["Draft", "Published", "Pending Archive", "Archived"] as const;
export const URGENCIES = ["Low", "Medium", "High"] as const;
export const EVENT_TYPES = ["reference", "deflection", "helpful", "unhelpful"] as const;

export class AudienceDto {
  @IsOptional() @IsString() @MaxLength(120) targetUserGroup?: string;
  @IsOptional() @IsString() @MaxLength(120) analystRole?: string;
  @IsOptional() @IsString() @MaxLength(120) workgroup?: string;
  @IsOptional() @IsString() @MaxLength(120) location?: string;
  @IsOptional() @IsString() @MaxLength(120) department?: string;
}

export class CreateKnowledgeArticleDto {
  @IsIn(ARTICLE_TYPES as unknown as string[]) articleType!: (typeof ARTICLE_TYPES)[number];
  @IsString() @IsNotEmpty() @MaxLength(300) title!: string;
  @IsOptional() @IsString() @MaxLength(120) serviceLine?: string;
  @IsOptional() @IsString() @MaxLength(2000) summary?: string;
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsString() @MaxLength(120) subcategory?: string;
  @IsOptional() @IsString() @MaxLength(120) service?: string;
  @IsOptional() @IsString() @MaxLength(160) configurationItem?: string;
  @IsOptional() @IsString() @MaxLength(20) relatedArticleCode?: string;

  /** Tags arrive as a list; the UI splits the comma-separated field. */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tags?: string[];

  @IsOptional() @IsObject() @ValidateNested() @Type(() => AudienceDto) audience?: AudienceDto;
  @IsOptional() @IsIn(SEVERITIES as unknown as string[]) severity?: (typeof SEVERITIES)[number];
  @IsOptional() @IsIn(URGENCIES as unknown as string[]) urgency?: (typeof URGENCIES)[number];
  @IsOptional() @IsString() @MaxLength(150) authorName?: string;
  @IsOptional() @IsString() @MaxLength(150) ownerName?: string;
  @IsOptional() @IsString() resolution?: string;
  /** Known errors only: the Problem record this belongs to. */
  @IsOptional() @IsString() @MaxLength(40) problemCode?: string;
  @IsOptional() @IsIn(ARTICLE_STATUSES as unknown as string[]) status?: (typeof ARTICLE_STATUSES)[number];
  @IsOptional() @IsString() @MaxLength(20) version?: string;
  @IsOptional() @IsDateString() reviewDate?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsInt() lifecycleWorkflowId?: number | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) reviewers?: string[];
  @IsOptional() @IsBoolean() enableSelfServicePortal?: boolean;
  @IsOptional() @IsBoolean() enableAnalystConsole?: boolean;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsBoolean() pinned?: boolean;
  @IsOptional() @IsBoolean() includeSearchIndex?: boolean;
  @IsOptional() @IsBoolean() allowComments?: boolean;
  @IsOptional() @IsBoolean() captureUsage?: boolean;
  @IsOptional() @IsBoolean() enableRating?: boolean;
  @IsOptional() @IsBoolean() autoSuggestIncident?: boolean;
  @IsOptional() @IsBoolean() enableAiSummaryTags?: boolean;
  @IsOptional() @IsBoolean() enableSimilarSuggestions?: boolean;
  @IsOptional() @IsBoolean() allowVersionComparison?: boolean;
}

export class UpdateKnowledgeArticleDto extends PartialType(CreateKnowledgeArticleDto) {}

export class KnowledgeEventDto {
  @IsIn(EVENT_TYPES as unknown as string[]) type!: (typeof EVENT_TYPES)[number];
  @IsOptional() @IsString() incidentId?: string;
}

export class KnowledgeArticleQueryDto {
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() serviceLine?: string;
  @IsOptional() @IsString() q?: string;
}

export class PortalArticleQueryDto {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
}
