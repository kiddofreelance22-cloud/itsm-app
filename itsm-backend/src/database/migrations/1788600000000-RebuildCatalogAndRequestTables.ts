import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Rebuilds the Catalog and Request schema on brand-new tables:
 *
 *  - Drops the old "Catalog" top-level grouping ("catalog_group_id") — the
 *    editor no longer has a separate "Catalog" dropdown. The Category field
 *    continues to use the existing, already-populated Incident category
 *    tree ("categories" table) — same shared tree, same picker UX.
 *  - Recreates "catalogs" and everything hanging off it (form sections,
 *    variables, variable options, attachments) as brand-new tables.
 *  - Recreates "requests", "request_history" and "request_variable_values"
 *    as brand-new tables tied to the rebuilt catalog schema.
 *
 * This is a destructive rebuild (existing catalog items and submitted
 * requests are not migrated) — acceptable for this change since the schema
 * shape itself is changing, not just being extended.
 */
export class RebuildCatalogAndRequestTables1788600000000 implements MigrationInterface {
  name = "RebuildCatalogAndRequestTables1788600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Drop old tables, leaf-first ─────────────────────────────────────────
    await queryRunner.query(`DROP TABLE IF EXISTS "request_variable_values"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "request_history"`);
    // Drop foreign key constraint from incidents table before dropping requests
    await queryRunner.query(`ALTER TABLE "incidents" DROP CONSTRAINT IF EXISTS "FK_6eeb6678fd5cdd7db2c6a53852a"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_variable_options"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_variables"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_form_sections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalogs"`);

    // ── Brand-new catalogs table ─────────────────────────────────────────────
    // Same shape as before minus the "Catalog" top-level grouping column
    // (catalog_group_id). category_id continues to reference the existing,
    // shared "categories" table (the same tree Incidents already use).
    await queryRunner.query(`
      CREATE TABLE "catalogs" (
        "catalog_id"                SERIAL NOT NULL,
        "catalog_name"               VARCHAR NOT NULL,
        "catalog_code"               VARCHAR,
        "short_description"          VARCHAR,
        "description"                TEXT,
        "category_id"                INTEGER
          REFERENCES "categories"("category_id") ON DELETE SET NULL,
        "is_active"                  BOOLEAN NOT NULL DEFAULT true,
        "allow_requested_for"        BOOLEAN NOT NULL DEFAULT true,
        "icon_url"                   VARCHAR,
        "banner_url"                 VARCHAR,
        "request_type"               VARCHAR NOT NULL DEFAULT 'Access',
        "approval_required"          BOOLEAN NOT NULL DEFAULT false,
        "stage"                      VARCHAR NOT NULL DEFAULT 'Production',
        "impact"                     VARCHAR NOT NULL DEFAULT 'Medium',
        "urgency"                    VARCHAR NOT NULL DEFAULT 'Medium',
        "default_priority"           VARCHAR NOT NULL DEFAULT 'P3 - Moderate',
        "sla_name"                   VARCHAR,
        "tags"                       TEXT[],
        "keywords"                   TEXT,
        "service_offering"           VARCHAR,
        "business_service"           VARCHAR,
        "configuration_item"         VARCHAR,
        "estimated_time"             INTEGER DEFAULT 2,
        "delivery_time_sla"          INTEGER DEFAULT 4,
        "hide_price"                 BOOLEAN NOT NULL DEFAULT false,
        "workflow_id"                INTEGER
          REFERENCES "workflows"("workflow_id") ON DELETE SET NULL,
        "approval_policy"            VARCHAR,
        "fulfillment_workflow_id"    INTEGER
          REFERENCES "workflows"("workflow_id") ON DELETE SET NULL,
        "fulfillment_group_id"       INTEGER
          REFERENCES "assignment_groups"("group_id") ON DELETE SET NULL,
        "assignment_group_id"        INTEGER
          REFERENCES "assignment_groups"("group_id") ON DELETE SET NULL,
        "available_in_portal"        BOOLEAN NOT NULL DEFAULT true,
        "available_in_mobile"        BOOLEAN NOT NULL DEFAULT true,
        "show_in_catalog"            BOOLEAN NOT NULL DEFAULT true,
        "show_in_popular"            BOOLEAN NOT NULL DEFAULT false,
        "requires_approval_for"      BOOLEAN NOT NULL DEFAULT false,
        "allow_requests_for_others"  BOOLEAN NOT NULL DEFAULT true,
        "enable_discussion"          BOOLEAN NOT NULL DEFAULT false,
        "visible_to"                 VARCHAR NOT NULL DEFAULT 'All Users',
        "user_groups"                TEXT[],
        "departments"                TEXT[],
        "locations"                  TEXT[],
        "show_section_numbers"       BOOLEAN NOT NULL DEFAULT true,
        "show_progress_indicator"    BOOLEAN NOT NULL DEFAULT true,
        "collapse_all_sections"      BOOLEAN NOT NULL DEFAULT false,
        "make_fields_mandatory"      BOOLEAN NOT NULL DEFAULT false,
        "form_layout"                VARCHAR NOT NULL DEFAULT 'single',
        "created_at"                 TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"                 TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_catalogs" PRIMARY KEY ("catalog_id")
      );
    `);

    // ── Form sections ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "catalog_form_sections" (
        "section_id"    SERIAL NOT NULL,
        "catalog_id"    INTEGER NOT NULL REFERENCES "catalogs"("catalog_id") ON DELETE CASCADE,
        "name"          VARCHAR NOT NULL,
        "description"   VARCHAR,
        "display_order" INTEGER NOT NULL DEFAULT 0,
        "created_at"    TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_catalog_form_sections" PRIMARY KEY ("section_id")
      );
    `);

    // ── Variables ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "catalog_variables" (
        "variable_id"        SERIAL NOT NULL,
        "catalog_id"         INTEGER NOT NULL REFERENCES "catalogs"("catalog_id") ON DELETE CASCADE,
        "section_id"         INTEGER REFERENCES "catalog_form_sections"("section_id") ON DELETE SET NULL,
        "section_name"       VARCHAR DEFAULT 'General',
        "label"              VARCHAR NOT NULL,
        "field_type"         VARCHAR NOT NULL,
        "is_mandatory"       BOOLEAN NOT NULL DEFAULT false,
        "default_value"      VARCHAR,
        "placeholder"        VARCHAR,
        "help_text"          VARCHAR,
        "is_visible"         BOOLEAN NOT NULL DEFAULT true,
        "read_only"          BOOLEAN NOT NULL DEFAULT false,
        "sort_order"         INTEGER NOT NULL DEFAULT 0,
        "is_active"          BOOLEAN NOT NULL DEFAULT true,
        "min_value"          VARCHAR,
        "max_value"          VARCHAR,
        "validation_regex"   VARCHAR,
        "date_min"           DATE,
        "date_max"           DATE,
        "allowed_file_types" VARCHAR,
        "max_file_size_mb"   INTEGER,
        "lookup_source"      VARCHAR,
        CONSTRAINT "PK_catalog_variables" PRIMARY KEY ("variable_id")
      );
    `);

    // ── Variable options ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "catalog_variable_options" (
        "option_id"    SERIAL NOT NULL,
        "variable_id"  INTEGER NOT NULL REFERENCES "catalog_variables"("variable_id") ON DELETE CASCADE,
        "option_label" VARCHAR NOT NULL,
        "option_value" VARCHAR NOT NULL,
        "sort_order"   INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "PK_catalog_variable_options" PRIMARY KEY ("option_id")
      );
    `);

    // ── Attachments ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "catalog_attachments" (
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

    // ── Brand-new requests tables ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "requests" (
        "request_id"      SERIAL NOT NULL,
        "catalog_id"      INTEGER NOT NULL REFERENCES "catalogs"("catalog_id") ON DELETE RESTRICT,
        "requested_by"    INTEGER NOT NULL REFERENCES "users"("user_id") ON DELETE RESTRICT,
        "status"          VARCHAR NOT NULL DEFAULT 'Submitted',
        "current_step_id" INTEGER REFERENCES "workflow_steps"("workflow_step_id") ON DELETE SET NULL,
        "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "closed_at"       TIMESTAMP,
        CONSTRAINT "PK_requests" PRIMARY KEY ("request_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "request_history" (
        "history_id"       SERIAL NOT NULL,
        "request_id"       INTEGER NOT NULL REFERENCES "requests"("request_id") ON DELETE CASCADE,
        "workflow_step_id" INTEGER REFERENCES "workflow_steps"("workflow_step_id") ON DELETE SET NULL,
        "action"           VARCHAR NOT NULL,
        "action_by"        INTEGER NOT NULL REFERENCES "users"("user_id") ON DELETE RESTRICT,
        "comments"         TEXT,
        "action_at"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_request_history" PRIMARY KEY ("history_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "request_variable_values" (
        "value_id"    SERIAL NOT NULL,
        "request_id"  INTEGER NOT NULL REFERENCES "requests"("request_id") ON DELETE CASCADE,
        "variable_id" INTEGER NOT NULL REFERENCES "catalog_variables"("variable_id") ON DELETE CASCADE,
        "value"       TEXT,
        CONSTRAINT "PK_request_variable_values" PRIMARY KEY ("value_id")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "request_variable_values"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "request_history"`);
    // Drop foreign key constraint from incidents table before dropping requests
    await queryRunner.query(`ALTER TABLE "incidents" DROP CONSTRAINT IF EXISTS "FK_6eeb6678fd5cdd7db2c6a53852a"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_variable_options"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_variables"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_form_sections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalogs"`);
    // Note: this down migration does not restore the pre-rebuild schema
    // (old "Catalog" grouping column) — treat this migration as a
    // one-way rebuild in practice.
  }
}
