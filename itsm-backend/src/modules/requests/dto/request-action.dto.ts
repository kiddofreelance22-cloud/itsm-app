import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

export class RequestActionDto {
  @ApiProperty({ example: "Approved", enum: ["Approved", "Rejected"] })
  @IsIn(["Approved", "Rejected"])
  action: "Approved" | "Rejected";

  @ApiPropertyOptional({ example: "Looks good, approved for procurement" })
  @IsOptional()
  @IsString()
  comments?: string;
}
