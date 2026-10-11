import { MigrationInterface, QueryRunner } from "typeorm";

export class AddServiceCategoryToCatalogs1789000000002 implements MigrationInterface {
  name = "AddServiceCategoryToCatalogs1789000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "catalogs" ADD COLUMN IF NOT EXISTS "service_category_id" INTEGER`);
    await queryRunner.query(`DO $$ BEGIN
      ALTER TABLE "catalogs" ADD CONSTRAINT "FK_catalogs_service_category" FOREIGN KEY ("service_category_id") REFERENCES "service_categories"("service_category_id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "catalogs" DROP CONSTRAINT IF EXISTS "FK_catalogs_service_category"`);
    await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "service_category_id"`);
  }
}