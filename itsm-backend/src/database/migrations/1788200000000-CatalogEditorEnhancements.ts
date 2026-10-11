import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Fills the gaps between the Catalog Item editor reference design and what
 * the schema actually supports:
 *   - "Catalog" (top-level grouping, e.g. "IT Services") was being bound to
 *     the same categoryId as "Category" in the UI. There was no column to
 *     hold a distinct top-level selection, so we add catalog_group_id
 *     (also a categories FK — the hierarchy already exists via
 *     categories.parent_category_id, this just lets a catalog item point at
 *     the top-level node independently of its leaf category).
 *   - "Sub Category" was a free-text column even though a real
 *     sub_categories table/entity already exists (used by Incidents). We add
 *     a proper sub_category_id FK; the legacy sub_category text column is
 *     left in place (and kept in sync by the service layer) so existing
 *     catalog-browsing code that filters on the free-text value doesn't
 *     break.
 *   - Form-level settings (section numbers, progress indicator, collapse,
 *     mandatory-by-default, layout) shown in the Variables tab had no
 *     backing columns.
 *   - Form sections were only a derived string on each variable
 *     (section_name, added by a previous migration but never used for
 *     anything beyond grouping). This adds a first-class
 *     catalog_form_sections table so sections can be created, renamed,
 *     reordered and deleted independently of any variable.
 *   - catalog_variables needs a section_id FK plus the remaining
 *     per-field-type configuration (date range, file restrictions, lookup
 *     source) that the 13 variable types in the design require.
 *   - catalog_attachments is new — nothing previously modelled the
 *     Attachments tab.
 */
export class CatalogEditorEnhancements1788200000000 implements MigrationInterface {
  name = "CatalogEditorEnhancements1788200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Catalog: catalog-group / sub-category FKs + form settings ──────────
    await queryRunner.query(`
      ALTER TABLE "catalogs"
        ADD COLUMN IF NOT EXISTS "catalog_group_id" INTEGER
          REFERENCES "categories"("category_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "sub_category_id" INTEGER
          REFERENCES "sub_categories"("sub_category_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "show_section_numbers"    BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "show_progress_indicator" BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "collapse_all_sections"   BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "make_fields_mandatory"   BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "form_layout"             VARCHAR NOT NULL DEFAULT 'single';
    `);

    // ── Form sections ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "catalog_form_sections" (
        "section_id"    SERIAL NOT NULL,
        "catalog_id"    INTEGER NOT NULL REFERENCES "catalogs"("catalog_id") ON DELETE CASCADE,
        "name"          VARCHAR NOT NULL,
        "description"   VARCHAR,
        "display_order" INTEGER NOT NULL DEFAULT 0,
        "created_at"    TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_catalog_form_sections" PRIMARY KEY ("section_id")
      );
    `);

    // ── catalog_variables: section link + remaining per-type config ────────
    // (section_name, placeholder, help_text, display_order, is_visible,
    // read_only, min_value, max_value, validation_regex already exist from
    // the 1785930000000 migration but were never wired up to the entity —
    // no change needed for those here.)
    await queryRunner.query(`
      ALTER TABLE "catalog_variables"
        ADD COLUMN IF NOT EXISTS "section_id" INTEGER
          REFERENCES "catalog_form_sections"("section_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "date_min"            DATE,
        ADD COLUMN IF NOT EXISTS "date_max"             DATE,
        ADD COLUMN IF NOT EXISTS "allowed_file_types"   VARCHAR,
        ADD COLUMN IF NOT EXISTS "max_file_size_mb"     INTEGER,
        ADD COLUMN IF NOT EXISTS "lookup_source"        VARCHAR;
    `);

    // ── Attachments ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "catalog_attachments" (
        "attachment_id" SERIAL NOT NULL,
        "catalog_id"    INTEGER NOT NULL REFERENCES "catalogs"("catalog_id") ON DELETE CASCADE,
        "file_name"     VARCHAR NOT NULL,
        "content_type"  VARCHAR,
        "size"          INTEGER NOT NULL DEFAULT 0,
        "storage_path"  VARCHAR NOT NULL,
        "created_by_id" INTEGER REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at"    TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_catalog_attachments" PRIMARY KEY ("attachment_id")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_attachments"`);

    const varCols = [
      "section_id", "date_min", "date_max",
      "allowed_file_types", "max_file_size_mb", "lookup_source",
    ];
    for (const col of varCols) {
      await queryRunner.query(`ALTER TABLE "catalog_variables" DROP COLUMN IF EXISTS "${col}"`);
    }

    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_form_sections"`);

    const catalogCols = [
      "catalog_group_id", "sub_category_id", "show_section_numbers",
      "show_progress_indicator", "collapse_all_sections",
      "make_fields_mandatory", "form_layout",
    ];
    for (const col of catalogCols) {
      await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "${col}"`);
    }
  }
}
