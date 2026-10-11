import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn,
} from "typeorm";
import { UserRole } from "../../roles/entities/user-role.entity";
import { AssignmentGroup } from "../../assignment-group/entities/assignment-group.entity";
import { Role } from "../../roles/entities/role.entity";
import { Department } from "../../departments/entities/department.entity";

export type UserType    = "Internal" | "External" | "Partner";
export type AuthType    = "Internal" | "LDAP" | "SAML" | "OAuth";
export type LandingPage = "My Dashboard" | "Home" | "My Incidents" | "Service Catalog";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn({ name: "user_id" })
  userId!: number;

  // ── Core auth ────────────────────────────────────────────────────────────
  @Column({ unique: true })
  username!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ name: "password_hash" })
  passwordHash!: string;

  @Column({ name: "is_active", default: true })
  isActive!: boolean;

  @Column({ name: "is_temp_password", default: false })
  isTempPassword!: boolean;

  @Column({ name: "temp_password_created_at", type: "timestamp", nullable: true })
  tempPasswordCreatedAt?: Date;

  // ── Name / display ───────────────────────────────────────────────────────
  @Column({ name: "first_name", nullable: true })
  firstName!: string;

  @Column({ name: "last_name", nullable: true })
  lastName!: string;

  /** Computed / user-editable display name */
  @Column({ name: "full_name" })
  fullName!: string;

  @Column({ name: "display_name", nullable: true })
  displayName!: string;

  @Column({ name: "profile_photo_url", nullable: true })
  profilePhotoUrl!: string;

  // ── Contact ──────────────────────────────────────────────────────────────
  @Column({ nullable: true })
  phone!: string;

  @Column({ name: "work_phone", nullable: true })
  workPhone!: string;

  @Column({ name: "mobile_phone", nullable: true })
  mobilePhone!: string;

  @Column({ name: "alternate_email", nullable: true })
  alternateEmail!: string;

  // ── Organisation ─────────────────────────────────────────────────────────
  @Column({ name: "employee_id", nullable: true })
  employeeId!: string;

  @Column({ name: "job_title", nullable: true })
  jobTitle!: string;

  @Column({ name: "department_id", nullable: true })
  departmentId?: number;

  @ManyToOne(() => Department, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "department_id" })
  department?: Department;

  @Column({ name: "manager_name", nullable: true })
  managerName!: string;

  @Column({ name: "business_service", nullable: true })
  businessService!: string;

  @Column({ name: "location", nullable: true })
  location!: string;

  @Column({ name: "cost_center", nullable: true })
  costCenter!: string;

  @Column({ name: "building", nullable: true })
  building!: string;

  @Column({ name: "floor", nullable: true })
  floor!: string;

  @Column({ name: "desk_number", nullable: true })
  deskNumber!: string;

  // ── Account settings ─────────────────────────────────────────────────────
  @Column({ name: "user_type", default: "Internal" })
  userType!: UserType;

  @Column({ name: "auth_type", default: "Internal" })
  authType!: AuthType;

  @Column({ name: "sso_enabled", default: false })
  ssoEnabled!: boolean;

  @Column({ name: "allow_mobile_access", default: true })
  allowMobileAccess!: boolean;

  @Column({ name: "allow_api_access", default: false })
  allowApiAccess!: boolean;

  @Column({ name: "allow_login", default: true })
  allowLogin!: boolean;

  @Column({ name: "review_required", default: false })
  reviewRequired!: boolean;

  /** Null = Never expire */
  @Column({ name: "password_expiry_days", type: "integer", nullable: true })
  passwordExpiryDays!: number;

  // ── Role & Access ─────────────────────────────────────────────────────────
  @ManyToOne(() => Role, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "role_id" })
  primaryRole?: Role;

  @ManyToOne(() => AssignmentGroup, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "assignment_group_id" })
  assignmentGroup?: AssignmentGroup;

  @Column({ name: "default_landing_page", default: "My Dashboard" })
  defaultLandingPage!: string;

  // ── Address ───────────────────────────────────────────────────────────────
  @Column({ name: "work_address", nullable: true })
  workAddress!: string;

  @Column({ name: "city", nullable: true })
  city!: string;

  @Column({ name: "state", nullable: true })
  state!: string;

  @Column({ name: "country", nullable: true })
  country!: string;

  @Column({ name: "postal_code", nullable: true })
  postalCode!: string;

  // ── Emergency Contact ─────────────────────────────────────────────────────
  @Column({ name: "emergency_contact_name", nullable: true })
  emergencyContactName!: string;

  @Column({ name: "emergency_contact_phone", nullable: true })
  emergencyContactPhone!: string;

  @Column({ name: "emergency_contact_relation", nullable: true })
  emergencyContactRelation!: string;

  // ── Preferences ───────────────────────────────────────────────────────────
  @Column({ name: "language", default: "English (US)" })
  language!: string;

  @Column({ name: "date_format", default: "DD MMM YYYY" })
  dateFormat!: string;

  @Column({ name: "time_zone", default: "(GMT+05:30) Asia/Kolkata" })
  timeZone!: string;

  @Column({ name: "notes", type: "text", nullable: true })
  notes!: string;

  // ── Timestamps ────────────────────────────────────────────────────────────
  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @OneToMany(() => UserRole, (ur) => ur.user)
  userRoles!: UserRole[];
}
