import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";
import { CreateRequestDto } from "./create-request.dto";

export class CreateAdminRequestDto extends CreateRequestDto {
  @ApiProperty({ example: 42, description: "User who will own the service request" })
  @IsInt()
  @Min(1)
  requestedById: number;
}
