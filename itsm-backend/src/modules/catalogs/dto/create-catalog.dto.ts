import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString } from "class-validator";

export class CreateCatalogDto {
  @ApiProperty({ example: "New Laptop Request" })
  @IsString()
  catalogName: string;

  @ApiPropertyOptional({ example: "Request a new company laptop" })
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 1, description: "categoryId this catalog item belongs to" })
  @IsInt()
  categoryId: number;

  @ApiPropertyOptional({ example: "https://cdn.example.com/icons/laptop.svg" })
  @IsOptional()
  @IsString()
  iconUrl?: string;

  @ApiPropertyOptional({
    example: 1,
    description: "workflowId triggered when this catalog item is submitted",
  })
  @IsOptional()
  @IsInt()
  workflowId?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
