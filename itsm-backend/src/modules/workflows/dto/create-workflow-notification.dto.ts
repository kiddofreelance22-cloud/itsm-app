import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsObject } from "class-validator";

export class CreateWorkflowNotificationDto {
  @ApiProperty()
  @IsInt()
  activityId: number;

  @ApiProperty()
  @IsString()
  notificationName: string;

  @ApiProperty()
  @IsString()
  recipientType: string; // requestor, approver, assignee, custom

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  recipientIds?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  triggerEvents?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  attachmentIds?: Record<string, unknown>;
}
