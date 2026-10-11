import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Enhances the catalog form builder with additional fields from the UI design:
 * - Catalog-level: tile_color, catalog_type, enable_bulk_sr_creation, link_to_other_category, status, visibility
 * - Variable-level: size, tooltip_text, only_integers, update_by, is_unique, display_in_email, auto_populate
 */
export class EnhanceCatalogFormBuilder1791000000000 implements MigrationInterface {
  name = "EnhanceCatalogFormBuilder1791000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Catalog enhancements ─────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "catalogs"
        ADD COLUMN IF NOT EXISTS "tile_color" VARCHAR(7),
        ADD COLUMN IF NOT EXISTS "catalog_type_id" INTEGER,
        ADD COLUMN IF NOT EXISTS "enable_bulk_sr_creation" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "link_to_other_category_id" INTEGER REFERENCES "categories"("category_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS "visibility" VARCHAR(20) NOT NULL DEFAULT 'public';
    `);

    // ── Catalog variable enhancements ────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "catalog_variables"
        ADD COLUMN IF NOT EXISTS "size" VARCHAR(20) NOT NULL DEFAULT 'medium',
        ADD COLUMN IF NOT EXISTS "tooltip_text" TEXT,
        ADD COLUMN IF NOT EXISTS "only_integers" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "update_by" VARCHAR(20) NOT NULL DEFAULT 'end_user',
        ADD COLUMN IF NOT EXISTS "is_unique" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "display_in_email" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "auto_populate" BOOLEAN NOT NULL DEFAULT false;
    `);

    // ── Create catalog_types table ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "catalog_types" (
        "catalog_type_id" SERIAL NOT NULL,
        "name" VARCHAR(255) NOT NULL UNIQUE,
        "description" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_catalog_types" PRIMARY KEY ("catalog_type_id")
      );
    `);

    // ── Add foreign key constraint for catalog_type_id ───────────────────────
    await queryRunner.query(`
      ALTER TABLE "catalogs"
        ADD CONSTRAINT "FK_catalogs_catalog_type"
        FOREIGN KEY ("catalog_type_id")
        REFERENCES "catalog_types"("catalog_type_id")
        ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Remove foreign key constraint ─────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "catalogs" DROP CONSTRAINT IF EXISTS "FK_catalogs_catalog_type";
    `);

    // ── Drop catalog_types table ─────────────────────────────────────────────
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_types"`);

    // ── Remove catalog variable enhancements ───────────────────────────────
    const varCols = [
      "size", "tooltip_text", "only_integers",
      "update_by", "is_unique", "display_in_email", "auto_populate",
    ];
    for (const col of varCols) {
      await queryRunner.query(`ALTER TABLE "catalog_variables" DROP COLUMN IF EXISTS "${col}"`);
    }

    // ── Remove catalog enhancements ───────────────────────────────────────────
    const catalogCols = [
      "tile_color", "catalog_type_id", "enable_bulk_sr_creation",
      "link_to_other_category_id", "status", "visibility",
    ];
    for (const col of catalogCols) {
      await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "${col}"`);
    }
  }
}
