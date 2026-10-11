import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateIncidentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ description: "Priority name — any value configured in Admin > Priority" })
  @IsOptional() @IsString() priority?: string;
  @ApiPropertyOptional({ description: "Impact level — any value configured in Admin > Impact" })
  @IsOptional() @IsString() impact?: string;
  @ApiPropertyOptional({ description: "Urgency level — any value configured in Admin > Urgency" })
  @IsOptional() @IsString() urgency?: string;
  @ApiPropertyOptional({ description: "Incident status — any configured status value" })
  @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() assignedTo?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() categoryId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() subCategoryId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() groupId?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() locationId?: number;
  @ApiPropertyOptional({ description: "SLA Service Window the Response/Resolution clocks follow; null = use the workgroup's window" }) @IsOptional() @IsInt() slaServiceWindowId?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() affectedAsset?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() businessService?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resolutionNotes?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() closureCode?: string | null;
  @ApiPropertyOptional({ description: "Resolution Code from Configuration > Resolution Code (required to resolve once any are configured)" })
  @IsOptional() @IsString() resolutionCode?: string | null;
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional() @IsInt() @Min(1) @Max(5) feedbackRating?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() feedbackComment?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() pendingReason?: string | null;
  @ApiPropertyOptional({ description: "Reason from Configuration > On Hold Reasons" })
  @IsOptional() @IsString() onHoldReason?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() classificationId?: number | null;
}
