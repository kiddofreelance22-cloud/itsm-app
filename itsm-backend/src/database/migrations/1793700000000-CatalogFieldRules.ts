import { MigrationInterface, QueryRunner } from "typeorm";

/** Two more field rules the catalog builder can set: a maximum text length, and "no dates in the past". */
export class CatalogFieldRules1793700000000 implements MigrationInterface {
  name = "CatalogFieldRules1793700000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "catalog_variables" ADD COLUMN IF NOT EXISTS "max_length" integer, ADD COLUMN IF NOT EXISTS "no_past_dates" boolean NOT NULL DEFAULT false`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "catalog_variables" DROP COLUMN IF EXISTS "no_past_dates", DROP COLUMN IF EXISTS "max_length"`);
  }
}
