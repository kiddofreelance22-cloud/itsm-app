import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class CreateVariableOptionDto {
  @ApiProperty({ example: "MacBook Pro 14\"" })
  @IsString()
  optionLabel: string;

  @ApiProperty({ example: "macbook_pro_14" })
  @IsString()
  optionValue: string;
}
