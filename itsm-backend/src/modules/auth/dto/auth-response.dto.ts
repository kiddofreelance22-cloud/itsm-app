import { ApiProperty } from "@nestjs/swagger";

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  user!: {
    userId: number;
    username: string;
    email: string;
    fullName: string;
    phone?: string;
    roles: string[];
    permissions: string[];
    isFirstLogin?: boolean;
  };
}
