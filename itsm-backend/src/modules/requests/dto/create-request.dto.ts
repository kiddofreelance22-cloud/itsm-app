import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsInt,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class RequestVariableValueDto {
  @ApiProperty({ example: 4, description: "variableId from the catalog's form" })
  @IsInt()
  variableId: number;

  @ApiProperty({ example: "MacBook Pro 14 inch" })
  @IsString()
  value: string;
}

export class CreateRequestDto {
  @ApiProperty({ example: 2, description: "catalogId being requested" })
  @IsInt()
  catalogId: number;

  @ApiProperty({ type: [RequestVariableValueDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestVariableValueDto)
  variableValues: RequestVariableValueDto[];
}
