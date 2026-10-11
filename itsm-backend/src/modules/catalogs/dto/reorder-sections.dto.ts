import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsInt, ValidateNested } from "class-validator";

class SectionOrderEntry {
  @ApiProperty() @IsInt() sectionId!: number;
  @ApiProperty() @IsInt() displayOrder!: number;
}

export class ReorderSectionsDto {
  @ApiProperty({ type: [SectionOrderEntry] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionOrderEntry)
  sections!: SectionOrderEntry[];
}
