import { ApiProperty } from "@nestjs/swagger";
import { IsInt } from "class-validator";

export class AssignRoleDto {
  @ApiProperty({ example: 5 })
  @IsInt()
  userId: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  roleId: number;
}
