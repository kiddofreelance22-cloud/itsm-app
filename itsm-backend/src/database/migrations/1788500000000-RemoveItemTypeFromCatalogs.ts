import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveItemTypeFromCatalogs1788500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if columns exist and drop them
    const columns = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'catalogs' 
      AND column_name IN ('item_type', 'sub_category', 'sub_category_id')
    `);
    
    const columnNames = columns.map((col: any) => col.column_name);
    
    if (columnNames.includes('item_type')) {
      await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN "item_type"`);
    }
    if (columnNames.includes('sub_category')) {
      await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN "sub_category"`);
    }
    if (columnNames.includes('sub_category_id')) {
      await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN "sub_category_id"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "catalogs" ADD COLUMN IF NOT EXISTS "item_type" VARCHAR DEFAULT 'Standard'
    `);
    await queryRunner.query(`
      ALTER TABLE "catalogs" ADD COLUMN IF NOT EXISTS "sub_category" VARCHAR
    `);
    await queryRunner.query(`
      ALTER TABLE "catalogs" ADD COLUMN IF NOT EXISTS "sub_category_id" INTEGER
    `);
  }
}
