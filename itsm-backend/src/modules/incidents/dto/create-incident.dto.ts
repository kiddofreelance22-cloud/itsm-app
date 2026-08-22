import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString } from "class-validator";

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
  @ApiPropertyOptional() @IsOptional() @IsString() affectedAsset?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() businessService?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() requestId?: number;
}
