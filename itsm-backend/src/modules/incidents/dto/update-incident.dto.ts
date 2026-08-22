import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString } from "class-validator";

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
  @ApiPropertyOptional() @IsOptional() @IsString() affectedAsset?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
}
