import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from "class-validator";

export class CreateCatalogDto {
  @ApiProperty()    @IsString()               catalogName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() catalogCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shortDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt()    categoryId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() subCategory?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() itemType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() iconUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bannerUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowRequestedFor?: boolean;
  // Additional info
  @ApiPropertyOptional() @IsOptional() @IsString()  requestType?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() approvalRequired?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString()  stage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  impact?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  urgency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  defaultPriority?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  slaName?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray()   tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString()  keywords?: string;
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
}
