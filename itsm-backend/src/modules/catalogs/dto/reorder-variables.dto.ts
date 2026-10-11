import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsInt, IsOptional, ValidateNested } from "class-validator";

class VariableOrderEntry {
  @ApiProperty() @IsInt() variableId!: number;
  @ApiProperty() @IsInt() sortOrder!: number;
  // Present when the drag also moved the variable into a different section
  // (or out of any section, in which case omit/send null).
  @ApiPropertyOptional() @IsOptional() @IsInt() sectionId?: number | null;
}

export class ReorderVariablesDto {
  @ApiProperty({ type: [VariableOrderEntry] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariableOrderEntry)
  variables!: VariableOrderEntry[];
}
