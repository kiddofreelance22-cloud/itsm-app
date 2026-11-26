import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPriorityImpactUrgencyRelationsToCatalogs1788600000000 implements MigrationInterface {
  name = 'AddPriorityImpactUrgencyRelationsToCatalogs1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new foreign key columns
    await queryRunner.query(`
      ALTER TABLE "catalogs" 
      ADD COLUMN "priority_id" INTEGER NULL,
      ADD CONSTRAINT "fk_catalogs_priority" 
      FOREIGN KEY ("priority_id") REFERENCES "priorities"("priority_id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "catalogs" 
      ADD COLUMN "impact_id" INTEGER NULL,
      ADD CONSTRAINT "fk_catalogs_impact" 
      FOREIGN KEY ("impact_id") REFERENCES "impacts"("impact_id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "catalogs" 
      ADD COLUMN "urgency_id" INTEGER NULL,
      ADD CONSTRAINT "fk_catalogs_urgency" 
      FOREIGN KEY ("urgency_id") REFERENCES "urgencies"("urgency_id") ON DELETE SET NULL
    `);

    // Migrate existing data - try to match by name
    await queryRunner.query(`
      UPDATE "catalogs" c
      SET "priority_id" = p."priority_id"
      FROM "priorities" p
      WHERE c."default_priority" IS NOT NULL 
        AND p."priority_name" = CASE 
          WHEN c."default_priority" LIKE '%Critical%' THEN 'Critical'
          WHEN c."default_priority" LIKE '%High%' THEN 'High'
          WHEN c."default_priority" LIKE '%Moderate%' THEN 'Medium'
          WHEN c."default_priority" LIKE '%Low%' THEN 'Low'
          ELSE c."default_priority"
        END
    `);

    await queryRunner.query(`
      UPDATE "catalogs" c
      SET "impact_id" = i."impact_id"
      FROM "impacts" i
      WHERE c."impact" IS NOT NULL 
        AND i."impact_name" = c."impact"
    `);

    await queryRunner.query(`
      UPDATE "catalogs" c
      SET "urgency_id" = u."urgency_id"
      FROM "urgencies" u
      WHERE c."urgency" IS NOT NULL 
        AND u."urgency_name" = c."urgency"
    `);

    // Drop old string columns
    await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "impact"`);
    await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "urgency"`);
    await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "default_priority"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore old string columns
    await queryRunner.query(`ALTER TABLE "catalogs" ADD COLUMN "impact" VARCHAR DEFAULT 'Medium'`);
    await queryRunner.query(`ALTER TABLE "catalogs" ADD COLUMN "urgency" VARCHAR DEFAULT 'Medium'`);
    await queryRunner.query(`ALTER TABLE "catalogs" ADD COLUMN "default_priority" VARCHAR DEFAULT 'P3 - Moderate'`);

    // Migrate data back to strings
    await queryRunner.query(`
      UPDATE "catalogs" c
      SET "impact" = i."impact_name"
      FROM "impacts" i
      WHERE c."impact_id" = i."impact_id"
    `);

    await queryRunner.query(`
      UPDATE "catalogs" c
      SET "urgency" = u."urgency_name"
      FROM "urgencies" u
      WHERE c."urgency_id" = u."urgency_id"
    `);

    await queryRunner.query(`
      UPDATE "catalogs" c
      SET "default_priority" = p."priority_name"
      FROM "priorities" p
      WHERE c."priority_id" = p."priority_id"
    `);

    // Drop foreign key columns
    await queryRunner.query(`ALTER TABLE "catalogs" DROP CONSTRAINT IF EXISTS "fk_catalogs_urgency"`);
    await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "urgency_id"`);
    await queryRunner.query(`ALTER TABLE "catalogs" DROP CONSTRAINT IF EXISTS "fk_catalogs_impact"`);
    await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "impact_id"`);
    await queryRunner.query(`ALTER TABLE "catalogs" DROP CONSTRAINT IF EXISTS "fk_catalogs_priority"`);
    await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "priority_id"`);
  }
}
