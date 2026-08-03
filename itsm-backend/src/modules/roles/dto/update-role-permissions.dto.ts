import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsNumber } from "class-validator";

export class UpdateRolePermissionsDto {
  @ApiProperty({
    description: "Array of permission IDs to assign to the role",
    example: [1, 2, 3, 4, 5],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsNotEmpty()
  permissionIds: number[];
}
