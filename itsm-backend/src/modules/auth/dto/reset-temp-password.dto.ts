import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ResetTempPasswordDto {
  @ApiProperty({ example: 'jdoe@company.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'The temporary password received via email' })
  @IsString()
  temporaryPassword!: string;

  @ApiProperty({ example: 'MyNewStr0ngP@ss', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
