import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSubCategoryAndItemTypeToCatalogs1788700000000 implements MigrationInterface {
  name = 'AddSubCategoryAndItemTypeToCatalogs1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add sub_category_id column
    await queryRunner.query(`
      ALTER TABLE "catalogs" 
      ADD COLUMN "sub_category_id" INTEGER NULL,
      ADD CONSTRAINT "fk_catalogs_sub_category" 
      FOREIGN KEY ("sub_category_id") REFERENCES "sub_categories"("sub_category_id") ON DELETE SET NULL
    `);

    // Add item_type column
    await queryRunner.query(`
      ALTER TABLE "catalogs" 
      ADD COLUMN "item_type" VARCHAR DEFAULT 'Standard'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop item_type column
    await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "item_type"`);
    
    // Drop sub_category_id column and constraint
    await queryRunner.query(`ALTER TABLE "catalogs" DROP CONSTRAINT IF EXISTS "fk_catalogs_sub_category"`);
    await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "sub_category_id"`);
  }
}
