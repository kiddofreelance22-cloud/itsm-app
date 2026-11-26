import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Matches } from "class-validator";

export class CreateIncidentDto {
  @ApiProperty({ example: "Outlook Error" })
  @IsString() title: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() categoryId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() subCategoryId?: number;
  @ApiPropertyOptional({ description: "Priority name — any value configured in Admin > Priority" })
  @IsOptional() @IsString() priority?: string;
  @ApiPropertyOptional({ description: "Impact level — any value configured in Admin > Impact" })
  @IsOptional() @IsString() impact?: string;
  @ApiPropertyOptional({ description: "Urgency level — any value configured in Admin > Urgency" })
  @IsOptional() @IsString() urgency?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() assignmentGroupId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() locationId?: number;
  @ApiPropertyOptional({ description: "SLA Service Window (staff only)" }) @IsOptional() @IsInt() slaServiceWindowId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() affectedAsset?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() businessService?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^\+?[0-9][0-9 ()-]{5,18}$/, { message: "Contact Number must be a valid phone number (digits, spaces, + ( ) - only; 6-20 characters)." }) contactNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() requestId?: number;
  @ApiPropertyOptional({ description: "Classification (Configuration > Classification)" }) @IsOptional() @IsInt() classificationId?: number;
  @ApiPropertyOptional({ example: "Phone" }) @IsOptional() @IsString() contactType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() callerEmail?: string;
  @ApiPropertyOptional({ description: "Log the incident on behalf of this user (resolvers/admins only)" }) @IsOptional() @IsInt() callerId?: number;
  @ApiPropertyOptional({ description: "Assign straight to this agent when creating" }) @IsOptional() @IsInt() assignedTo?: number;
}
