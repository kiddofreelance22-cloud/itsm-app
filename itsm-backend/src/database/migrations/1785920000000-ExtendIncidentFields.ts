import { MigrationInterface, QueryRunner } from "typeorm";

export class ExtendIncidentFields1785920000000 implements MigrationInterface {
  name = "ExtendIncidentFields1785920000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "incidents"
        ADD COLUMN IF NOT EXISTS "impact"           VARCHAR  NOT NULL DEFAULT 'Medium',
        ADD COLUMN IF NOT EXISTS "urgency"          VARCHAR  NOT NULL DEFAULT 'Medium',
        ADD COLUMN IF NOT EXISTS "sub_category"     VARCHAR,
        ADD COLUMN IF NOT EXISTS "location"         VARCHAR,
        ADD COLUMN IF NOT EXISTS "affected_asset"   VARCHAR,
        ADD COLUMN IF NOT EXISTS "contact_number"   VARCHAR,
        ADD COLUMN IF NOT EXISTS "email_id"         VARCHAR,
        ADD COLUMN IF NOT EXISTS "department"       VARCHAR,
        ADD COLUMN IF NOT EXISTS "business_service" VARCHAR,
        ADD COLUMN IF NOT EXISTS "sla_response_target"    TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "sla_resolution_target"  TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "sla_responded_at"       TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "updated_at"       TIMESTAMP NOT NULL DEFAULT now();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const cols = [
      "impact","urgency","sub_category","location","affected_asset",
      "contact_number","email_id","department","business_service",
      "sla_response_target","sla_resolution_target","sla_responded_at","updated_at",
    ];
    for (const col of cols) {
      await queryRunner.query(`ALTER TABLE "incidents" DROP COLUMN IF EXISTS "${col}"`);
    }
  }
}
