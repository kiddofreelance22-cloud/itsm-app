import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReferenceNameUniqueness1785940000002 implements MigrationInterface {
  name = "AddReferenceNameUniqueness1785940000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "categories" duplicate
      USING "categories" original
      WHERE duplicate."category_id" > original."category_id"
        AND lower(trim(duplicate."category_name")) = lower(trim(original."category_name"));
    `);

    await queryRunner.query(`
      DELETE FROM "sub_categories" duplicate
      USING "sub_categories" original
      WHERE duplicate."sub_category_id" > original."sub_category_id"
        AND lower(trim(duplicate."sub_category_name")) = lower(trim(original."sub_category_name"))
        AND duplicate."category_id" IS NOT DISTINCT FROM original."category_id";
    `);

    await queryRunner.query(`
      DELETE FROM "priorities" duplicate
      USING "priorities" original
      WHERE duplicate."priority_id" > original."priority_id"
        AND lower(trim(duplicate."priority_name")) = lower(trim(original."priority_name"));
    `);

    await queryRunner.query(`
      DELETE FROM "impacts" duplicate
      USING "impacts" original
      WHERE duplicate."impact_id" > original."impact_id"
        AND lower(trim(duplicate."impact_name")) = lower(trim(original."impact_name"));
    `);

    await queryRunner.query(`
      DELETE FROM "urgencies" duplicate
      USING "urgencies" original
      WHERE duplicate."urgency_id" > original."urgency_id"
        AND lower(trim(duplicate."urgency_name")) = lower(trim(original."urgency_name"));
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_categories_name_normalized"
      ON "categories" (lower(trim("category_name")));
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_sub_categories_name_category_normalized"
      ON "sub_categories" (lower(trim("sub_category_name")), coalesce("category_id", 0));
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_priorities_name_normalized"
      ON "priorities" (lower(trim("priority_name")));
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_impacts_name_normalized"
      ON "impacts" (lower(trim("impact_name")));
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_urgencies_name_normalized"
      ON "urgencies" (lower(trim("urgency_name")));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_urgencies_name_normalized";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_impacts_name_normalized";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_priorities_name_normalized";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sub_categories_name_category_normalized";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_categories_name_normalized";`);
  }
}