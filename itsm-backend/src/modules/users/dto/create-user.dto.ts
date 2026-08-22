import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean, IsEmail, IsIn, IsInt, IsOptional,
  IsString, MinLength, Min, Max,
} from "class-validator";

const USER_TYPES  = ["Internal", "External", "Partner"] as const;
const AUTH_TYPES  = ["Internal", "LDAP", "SAML", "OAuth"] as const;

export class CreateUserDto {
  // ── Core auth ──────────────────────────────────────────────────────────
  @ApiProperty({ example: "john.smith" })
  @IsString()
  username!: string;

  @ApiPropertyOptional({ example: "P@ssword1!", minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  // ── Name ──────────────────────────────────────────────────────────────
  @ApiProperty({ example: "John" })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: "Smith" })
  @IsString()
  lastName!: string;

  @ApiPropertyOptional({ example: "John Smith" })
  @IsOptional()
  @IsString()
  displayName?: string;

  // ── Contact ───────────────────────────────────────────────────────────
  @ApiProperty({ example: "john.smith@company.com" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: "+91 98765 43210" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: "+91 22 1234 5678" })
  @IsOptional()
  @IsString()
  workPhone?: string;

  @ApiPropertyOptional({ example: "+91 98765 43210" })
  @IsOptional()
  @IsString()
  mobilePhone?: string;

  @ApiPropertyOptional({ example: "john.smith.personal@gmail.com" })
  @IsOptional()
  @IsEmail()
  alternateEmail?: string;

  // ── Organisation ──────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: "E12345" })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ example: "IT Support Specialist" })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional({ example: "IT Support" })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: "Amit Sharma" })
  @IsOptional()
  @IsString()
  managerName?: string;

  @ApiPropertyOptional({ example: "IT Support" })
  @IsOptional()
  @IsString()
  businessService?: string;

  @ApiPropertyOptional({ example: "Mumbai - Head Office" })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: "CC-100" })
  @IsOptional()
  @IsString()
  costCenter?: string;

  @ApiPropertyOptional({ example: "Building A" })
  @IsOptional()
  @IsString()
  building?: string;

  @ApiPropertyOptional({ example: "2" })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({ example: "D-205" })
  @IsOptional()
  @IsString()
  deskNumber?: string;

  // ── Account settings ──────────────────────────────────────────────────
  @ApiPropertyOptional({ enum: USER_TYPES, default: "Internal" })
  @IsOptional()
  @IsIn(USER_TYPES)
  userType?: (typeof USER_TYPES)[number];

  @ApiPropertyOptional({ enum: AUTH_TYPES, default: "Internal" })
  @IsOptional()
  @IsIn(AUTH_TYPES)
  authType?: (typeof AUTH_TYPES)[number];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  ssoEnabled?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowMobileAccess?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowApiAccess?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowLogin?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  reviewRequired?: boolean;

  @ApiPropertyOptional({ example: 90, description: "Null = never expire" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  passwordExpiryDays?: number | null;

  // ── Role & Access ────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  roleId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  assignmentGroupId?: number;

  @ApiPropertyOptional({ example: "My Dashboard" })
  @IsOptional()
  @IsString()
  defaultLandingPage?: string;

  // ── Address ───────────────────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  // ── Emergency Contact ─────────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactRelation?: string;

  // ── Preferences ───────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: "English (US)" })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ example: "DD MMM YYYY (16 May 2025)" })
  @IsOptional()
  @IsString()
  dateFormat?: string;

  @ApiPropertyOptional({ example: "(GMT+05:30) Asia/Kolkata" })
  @IsOptional()
  @IsString()
  timeZone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
