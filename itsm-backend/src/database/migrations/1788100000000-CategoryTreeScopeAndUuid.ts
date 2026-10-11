import { MigrationInterface, QueryRunner } from "typeorm";
import { randomUUID } from "crypto";

export class CategoryTreeScopeAndUuid1788100000000 implements MigrationInterface {
  name = "CategoryTreeScopeAndUuid1788100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
        ADD COLUMN "node_uuid" uuid,
        ADD COLUMN "materialized_path" text,
        ADD COLUMN "workgroup_ids" integer[],
        ADD COLUMN "location_ids" integer[],
        ADD COLUMN "member_ids" integer[];
    `);

    // ── Backfill node_uuid for existing rows ────────────────────────────────
    // Generated in application code (rather than requiring the pgcrypto /
    // uuid-ossp extensions to be enabled on every environment) so this
    // migration has no external dependencies.
    const rows: { category_id: number }[] = await queryRunner.query(
      `SELECT "category_id" FROM "categories"`
    );
    for (const row of rows) {
      await queryRunner.query(
        `UPDATE "categories" SET "node_uuid" = $1 WHERE "category_id" = $2`,
        [randomUUID(), row.category_id]
      );
    }

    await queryRunner.query(`
      ALTER TABLE "categories" ALTER COLUMN "node_uuid" SET NOT NULL;
      ALTER TABLE "categories" ADD CONSTRAINT "UQ_categories_node_uuid" UNIQUE ("node_uuid");
    `);

    // ── Backfill materialized_path breadth-first from the roots down ───────
    let frontier: { category_id: number; parent_category_id: number | null }[] = await queryRunner.query(
      `SELECT "category_id", "parent_category_id" FROM "categories" WHERE "parent_category_id" IS NULL`
    );
    const pathById = new Map<number, string>();
    for (const root of frontier) pathById.set(root.category_id, `/${root.category_id}/`);

    while (frontier.length) {
      for (const node of frontier) {
        await queryRunner.query(
          `UPDATE "categories" SET "materialized_path" = $1 WHERE "category_id" = $2`,
          [pathById.get(node.category_id), node.category_id]
        );
      }
      const parentIds = frontier.map((n) => n.category_id);
      const nextFrontier: { category_id: number; parent_category_id: number }[] = await queryRunner.query(
        `SELECT "category_id", "parent_category_id" FROM "categories" WHERE "parent_category_id" = ANY($1)`,
        [parentIds]
      );
      for (const n of nextFrontier) {
        pathById.set(n.category_id, `${pathById.get(n.parent_category_id)}${n.category_id}/`);
      }
      frontier = nextFrontier;
    }

    // Any row that (due to a broken parent pointer) never got visited still
    // needs a path so LIKE-prefix subtree queries keep working for it.
    await queryRunner.query(`
      UPDATE "categories" SET "materialized_path" = '/' || "category_id" || '/'
      WHERE "materialized_path" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
        DROP CONSTRAINT IF EXISTS "UQ_categories_node_uuid",
        DROP COLUMN IF EXISTS "node_uuid",
        DROP COLUMN IF EXISTS "materialized_path",
        DROP COLUMN IF EXISTS "workgroup_ids",
        DROP COLUMN IF EXISTS "location_ids",
        DROP COLUMN IF EXISTS "member_ids";
    `);
  }
}
