import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
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

  @ApiProperty({ required: false, description: "Raise the request for another person. They become the requester; you are recorded as the person who submitted it." })
  @IsOptional() @IsInt()
  requestedForUserId?: number;

  @ApiProperty({ required: false, description: "Urgency chosen by the requester (defaults to the catalog item's)" })
  @IsOptional() @IsInt()
  urgencyId?: number;

  @ApiProperty({ required: false, description: "Impact chosen by the requester (defaults to the catalog item's)" })
  @IsOptional() @IsInt()
  serviceImpactId?: number;

  @ApiProperty({ required: false, description: "Service request priority override" })
  @IsOptional() @IsInt()
  priorityId?: number;

  @ApiProperty({ required: false, description: "Additional notes for the approver / fulfilment team" })
  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;
}
