import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIncidentResolutionFeedback1791200000001 implements MigrationInterface {
  name = "AddIncidentResolutionFeedback1791200000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "incidents"
      ADD COLUMN IF NOT EXISTS "resolution_notes" text,
      ADD COLUMN IF NOT EXISTS "closure_code" character varying,
      ADD COLUMN IF NOT EXISTS "feedback_rating" integer,
      ADD COLUMN IF NOT EXISTS "feedback_comment" text,
      ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "incidents"
      DROP COLUMN IF EXISTS "closed_at",
      DROP COLUMN IF EXISTS "feedback_comment",
      DROP COLUMN IF EXISTS "feedback_rating",
      DROP COLUMN IF EXISTS "closure_code",
      DROP COLUMN IF EXISTS "resolution_notes"
    `);
  }
}