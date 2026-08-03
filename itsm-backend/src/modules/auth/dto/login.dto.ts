import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "jdoe" })
  @IsString()
  username!: string;

  @ApiProperty({ example: "S3curePassword!" })
  @IsString()
  @MinLength(6)
  password!: string;
}
