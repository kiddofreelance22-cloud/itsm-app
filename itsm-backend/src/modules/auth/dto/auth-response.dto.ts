import { ApiProperty } from "@nestjs/swagger";

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  impersonationId?: string;
  expiresAt?: number;

  @ApiProperty()
  user!: {
    userId: number;
    username: string;
    email: string;
    fullName: string;
    profilePhotoUrl?: string;
    phone?: string;
    roles: string[];
    permissions: string[];
    isFirstLogin?: boolean;
    impersonatedBy?: { userId: number; fullName: string };
  };
}
