import { MigrationInterface, QueryRunner } from "typeorm";

export class ExtendCategories1785910000000 implements MigrationInterface {
  name = "ExtendCategories1785910000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
        ADD COLUMN IF NOT EXISTS "category_code"              VARCHAR UNIQUE,
        ADD COLUMN IF NOT EXISTS "display_order"              INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "icon"                       VARCHAR,
        ADD COLUMN IF NOT EXISTS "available_in_portal"        BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "available_in_mobile"        BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "show_in_catalog"            BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "allow_in_incident"          BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "updated_at"                 TIMESTAMP NOT NULL DEFAULT now();
    `);

    /* Backfill category codes for existing rows that have none */
    await queryRunner.query(`
      UPDATE "categories"
      SET "category_code" = CONCAT('CAT_', UPPER(REPLACE(TRIM("category_name"), ' ', '_')))
      WHERE "category_code" IS NULL;
    `);

    /* Populate display_order from existing primary-key order */
    await queryRunner.query(`
      WITH ordered AS (
        SELECT "category_id", ROW_NUMBER() OVER (ORDER BY "category_id") AS rn
        FROM "categories"
      )
      UPDATE "categories" c
      SET "display_order" = o.rn
      FROM ordered o
      WHERE c."category_id" = o."category_id"
        AND c."display_order" = 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const col of [
      "category_code", "display_order", "icon",
      "available_in_portal", "available_in_mobile",
      "show_in_catalog", "allow_in_incident", "updated_at",
    ]) {
      await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN IF EXISTS "${col}"`);
    }
  }
}
