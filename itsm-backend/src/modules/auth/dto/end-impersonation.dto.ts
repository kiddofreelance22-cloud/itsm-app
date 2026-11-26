import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class EndImpersonationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  impersonationId!: string;
}
