import { IsInt, Min } from "class-validator";

export class SwitchUserDto {
  @IsInt()
  @Min(1)
  userId!: number;
}
