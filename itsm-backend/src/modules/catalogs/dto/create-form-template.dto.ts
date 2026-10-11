import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsObject, IsOptional, IsString } from "class-validator";

const TEMPLATE_TYPES = ["group", "form"] as const;

export class CreateFormTemplateDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TEMPLATE_TYPES })
  @IsIn(TEMPLATE_TYPES)
  templateType: (typeof TEMPLATE_TYPES)[number];

  @ApiProperty()
  @IsObject()
  templateData: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  createdById?: number;
}
