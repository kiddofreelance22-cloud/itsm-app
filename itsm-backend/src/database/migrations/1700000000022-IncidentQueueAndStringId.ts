import { MigrationInterface, QueryRunner } from "typeorm";

export class IncidentQueueAndStringId1700000000022 implements MigrationInterface {
  name = "IncidentQueueAndStringId1700000000022";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add string incident_code column (the user-facing INC000001 id)
    await queryRunner.query(`
      ALTER TABLE "incidents"
        ADD COLUMN IF NOT EXISTS "incident_code" VARCHAR(20) UNIQUE,
        ADD COLUMN IF NOT EXISTS "group_id" INTEGER REFERENCES "assignment_groups"("group_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "claimed_at" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "impact" VARCHAR(20) DEFAULT 'Medium',
        ADD COLUMN IF NOT EXISTS "urgency" VARCHAR(20) DEFAULT 'Medium',
        ADD COLUMN IF NOT EXISTS "sub_category_id" INTEGER REFERENCES "sub_categories"("sub_category_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "location_id" INTEGER REFERENCES "locations"("location_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "affected_asset" VARCHAR(200),
        ADD COLUMN IF NOT EXISTS "business_service" VARCHAR(200),
        ADD COLUMN IF NOT EXISTS "contact_number" VARCHAR(30),
        ADD COLUMN IF NOT EXISTS "department" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "sla_response_target" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "sla_resolution_target" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "sla_response_met" BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS "sla_breached" BOOLEAN DEFAULT false;
    `);

// 2. Seed existing rows with incident_code if they don't have one.
// incident_id is already the user-facing INCxxxxxx string.
await queryRunner.query(`
  UPDATE "incidents"
  SET "incident_code" = "incident_id"
  WHERE "incident_code" IS NULL;
`);

    // 3. Activity log table (replaces simple comments — unified timeline)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "incident_activity" (
        "activity_id"   SERIAL PRIMARY KEY,
        "incident_id"   VARCHAR NOT NULL REFERENCES "incidents"("incident_id") ON DELETE CASCADE,
        "actor_id"      INTEGER REFERENCES "users"("user_id") ON DELETE SET NULL,
        "type"          VARCHAR(50) NOT NULL DEFAULT 'comment',
        "content"       TEXT,
        "meta"          JSONB,
        "is_work_note"  BOOLEAN NOT NULL DEFAULT false,
        "created_at"    TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "incident_activity";`);
    await queryRunner.query(`
      ALTER TABLE "incidents"
        DROP COLUMN IF EXISTS "incident_code",
        DROP COLUMN IF EXISTS "group_id",
        DROP COLUMN IF EXISTS "claimed_at",
        DROP COLUMN IF EXISTS "impact",
        DROP COLUMN IF EXISTS "urgency",
        DROP COLUMN IF EXISTS "sub_category_id",
        DROP COLUMN IF EXISTS "location_id",
        DROP COLUMN IF EXISTS "affected_asset",
        DROP COLUMN IF EXISTS "business_service",
        DROP COLUMN IF EXISTS "contact_number",
        DROP COLUMN IF EXISTS "department",
        DROP COLUMN IF EXISTS "sla_response_target",
        DROP COLUMN IF EXISTS "sla_resolution_target",
        DROP COLUMN IF EXISTS "sla_response_met",
        DROP COLUMN IF EXISTS "sla_breached";
    `);
  }
}
