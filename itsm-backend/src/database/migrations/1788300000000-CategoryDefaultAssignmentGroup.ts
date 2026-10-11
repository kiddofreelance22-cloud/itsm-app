import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds category-based incident routing. Category already had `workgroupIds`
 * (which workgroups a category is *visible to*, with inheritance) but
 * nothing that says which group an incident in that category should
 * actually go to — incidents.service.ts fell back straight to the single
 * global `isDefault` assignment group regardless of category, which is the
 * "category routing is not working" bug.
 */
export class CategoryDefaultAssignmentGroup1788300000000 implements MigrationInterface {
  name = "CategoryDefaultAssignmentGroup1788300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
        ADD COLUMN IF NOT EXISTS "default_assignment_group_id" INTEGER
          REFERENCES "assignment_groups"("group_id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN IF EXISTS "default_assignment_group_id"`);
  }
}
