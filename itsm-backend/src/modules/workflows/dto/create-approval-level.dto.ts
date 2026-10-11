import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString } from "class-validator";

export class CreateApprovalLevelDto {
  @ApiProperty()
  @IsInt()
  activityId: number;

  @ApiProperty()
  @IsInt()
  levelNumber: number;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  approverType: string; // user, group, role, custom

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  approverId?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  autoApproval?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  emailNotificationsForEndUser?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  referBackToRequestor?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  referBackToPreviousApprovers?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  customGroupId?: number;
}
