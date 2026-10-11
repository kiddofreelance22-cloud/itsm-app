import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsNumber } from "class-validator";

const FORM_LAYOUTS = ["single", "two-column"] as const;
const CATALOG_STATUSES = ["draft", "published", "archived"] as const;
const VISIBILITY_TYPES = ["public", "internal", "private"] as const;

export class CreateCatalogDto {
  @ApiProperty()    @IsString()               catalogName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() catalogCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shortDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  // Category picked from the existing Incident category tree (shared
  // `categories` table) — same tree, same parent/child picker UX.
  @ApiPropertyOptional() @IsOptional() @IsInt()    categoryId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt()    serviceCategoryId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() iconUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bannerUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tileColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() catalogTypeId?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowRequestedFor?: boolean;
  // Additional info
  @ApiPropertyOptional() @IsOptional() @IsString()  requestType?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() approvalRequired?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString()  stage?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt()    subCategoryId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString()  itemType?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt()    priorityId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt()    impactId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt()    urgencyId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString()  slaName?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray()   tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString()  keywords?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableBulkSrCreation?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt()    linkToOtherCategoryId?: number;
  @ApiPropertyOptional({ enum: CATALOG_STATUSES }) @IsOptional() @IsIn(CATALOG_STATUSES) status?: (typeof CATALOG_STATUSES)[number];
  @ApiPropertyOptional({ enum: VISIBILITY_TYPES }) @IsOptional() @IsIn(VISIBILITY_TYPES) visibility?: (typeof VISIBILITY_TYPES)[number];
  // Service offering
  @ApiPropertyOptional() @IsOptional() @IsString()  serviceOffering?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  businessService?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  configurationItem?: string;
  // Time / cost
  @ApiPropertyOptional() @IsOptional() @IsInt()     estimatedTime?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt()     deliveryTimeSla?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hidePrice?: boolean;
  // Workflow
  @ApiPropertyOptional() @IsOptional() @IsInt()     workflowId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString()  approvalPolicy?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt()     fulfillmentWorkflowId?: number;
  // Assignment
  @ApiPropertyOptional() @IsOptional() @IsInt()     fulfillmentGroupId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt()     assignmentGroupId?: number;
  // Visibility
  @ApiPropertyOptional() @IsOptional() @IsBoolean() availableInPortal?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() availableInMobile?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showInCatalog?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showInPopular?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresApprovalFor?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowRequestsForOthers?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableDiscussion?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString()  visibleTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray()   userGroups?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray()   departments?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray()   locations?: string[];
  // Variables (Form) settings
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showSectionNumbers?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showProgressIndicator?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() collapseAllSections?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() makeFieldsMandatory?: boolean;
  @ApiPropertyOptional({ enum: FORM_LAYOUTS }) @IsOptional() @IsIn(FORM_LAYOUTS) formLayout?: (typeof FORM_LAYOUTS)[number];
}
