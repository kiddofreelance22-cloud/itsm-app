import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CancelRequestDto {
  @ApiPropertyOptional({ example: "No longer needed" })
  @IsOptional()
  @IsString()
  comments?: string;
}
