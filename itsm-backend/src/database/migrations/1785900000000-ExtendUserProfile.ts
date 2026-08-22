import { MigrationInterface, QueryRunner } from "typeorm";

export class ExtendUserProfile1785900000000 implements MigrationInterface {
  name = "ExtendUserProfile1785900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "first_name"          VARCHAR,
        ADD COLUMN IF NOT EXISTS "last_name"           VARCHAR,
        ADD COLUMN IF NOT EXISTS "display_name"        VARCHAR,
        ADD COLUMN IF NOT EXISTS "profile_photo_url"   VARCHAR,
        ADD COLUMN IF NOT EXISTS "employee_id"         VARCHAR,
        ADD COLUMN IF NOT EXISTS "job_title"           VARCHAR,
        ADD COLUMN IF NOT EXISTS "department"          VARCHAR,
        ADD COLUMN IF NOT EXISTS "manager_name"        VARCHAR,
        ADD COLUMN IF NOT EXISTS "business_service"    VARCHAR,
        ADD COLUMN IF NOT EXISTS "location"            VARCHAR,
        ADD COLUMN IF NOT EXISTS "user_type"           VARCHAR  NOT NULL DEFAULT 'Internal',
        ADD COLUMN IF NOT EXISTS "auth_type"           VARCHAR  NOT NULL DEFAULT 'Internal',
        ADD COLUMN IF NOT EXISTS "sso_enabled"         BOOLEAN  NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "allow_mobile_access" BOOLEAN  NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "allow_api_access"    BOOLEAN  NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "allow_login"         BOOLEAN  NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "review_required"     BOOLEAN  NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "password_expiry_days" INTEGER,
        ADD COLUMN IF NOT EXISTS "default_landing_page" VARCHAR  DEFAULT 'My Dashboard',
        ADD COLUMN IF NOT EXISTS "language"            VARCHAR  DEFAULT 'English (US)',
        ADD COLUMN IF NOT EXISTS "date_format"         VARCHAR  DEFAULT 'DD MMM YYYY',
        ADD COLUMN IF NOT EXISTS "time_zone"           VARCHAR  DEFAULT '(GMT+05:30) Asia/Kolkata',
        ADD COLUMN IF NOT EXISTS "notes"               TEXT,
        ADD COLUMN IF NOT EXISTS "work_phone"          VARCHAR,
        ADD COLUMN IF NOT EXISTS "mobile_phone"        VARCHAR,
        ADD COLUMN IF NOT EXISTS "alternate_email"     VARCHAR,
        ADD COLUMN IF NOT EXISTS "work_address"        VARCHAR,
        ADD COLUMN IF NOT EXISTS "city"                VARCHAR,
        ADD COLUMN IF NOT EXISTS "state"               VARCHAR,
        ADD COLUMN IF NOT EXISTS "country"             VARCHAR,
        ADD COLUMN IF NOT EXISTS "postal_code"         VARCHAR,
        ADD COLUMN IF NOT EXISTS "emergency_contact_name"  VARCHAR,
        ADD COLUMN IF NOT EXISTS "emergency_contact_phone" VARCHAR,
        ADD COLUMN IF NOT EXISTS "emergency_contact_relation" VARCHAR,
        ADD COLUMN IF NOT EXISTS "cost_center"         VARCHAR,
        ADD COLUMN IF NOT EXISTS "building"            VARCHAR,
        ADD COLUMN IF NOT EXISTS "floor"               VARCHAR,
        ADD COLUMN IF NOT EXISTS "desk_number"         VARCHAR,
        ADD COLUMN IF NOT EXISTS "assignment_group_id" INTEGER
          REFERENCES "assignment_groups"("group_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "role_id"             INTEGER
          REFERENCES "roles"("role_id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const cols = [
      "first_name","last_name","display_name","profile_photo_url",
      "employee_id","job_title","department","manager_name","business_service",
      "location","user_type","auth_type","sso_enabled","allow_mobile_access",
      "allow_api_access","allow_login","review_required","password_expiry_days",
      "default_landing_page","language","date_format","time_zone","notes",
      "work_phone","mobile_phone","alternate_email","work_address","city",
      "state","country","postal_code","emergency_contact_name",
      "emergency_contact_phone","emergency_contact_relation","cost_center",
      "building","floor","desk_number","assignment_group_id","role_id",
    ];
    for (const col of cols) {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "${col}"`);
    }
  }
}
