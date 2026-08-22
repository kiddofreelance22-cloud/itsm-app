import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPrioritySlaColumns1785940000003 implements MigrationInterface {
  name = "AddPrioritySlaColumns1785940000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "priorities"
      ADD COLUMN IF NOT EXISTS "response_sla_minutes" INTEGER;
    `);
    await queryRunner.query(`
      ALTER TABLE "priorities"
      ADD COLUMN IF NOT EXISTS "resolution_sla_minutes" INTEGER;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "priorities"
      DROP COLUMN IF EXISTS "resolution_sla_minutes";
    `);
    await queryRunner.query(`
      ALTER TABLE "priorities"
      DROP COLUMN IF EXISTS "response_sla_minutes";
    `);
  }
}