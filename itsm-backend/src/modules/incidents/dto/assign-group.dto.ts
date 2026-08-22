import { ApiProperty } from "@nestjs/swagger";
import { IsInt } from "class-validator";

export class AssignGroupDto {
  @ApiProperty() @IsInt() assignmentGroupId: number;
}
