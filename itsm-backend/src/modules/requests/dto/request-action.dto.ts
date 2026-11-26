import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export class RequestActionDto {
  @ApiProperty({ example: "Approved", enum: ["Approved", "Rejected"] })
  @IsIn(["Approved", "Rejected"])
  action: "Approved" | "Rejected";

  @ApiPropertyOptional({ example: "Looks good, approved for procurement" })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiPropertyOptional({ example: 42, description: "The approval level shown when this decision was started" })
  @IsOptional()
  @IsInt()
  @Min(1)
  requestApprovalId?: number;
}
