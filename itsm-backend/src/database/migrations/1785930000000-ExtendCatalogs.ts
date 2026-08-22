import { MigrationInterface, QueryRunner } from "typeorm";

export class ExtendCatalogs1785930000000 implements MigrationInterface {
  name = "ExtendCatalogs1785930000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Main catalogs table ─────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "catalogs"
        ADD COLUMN IF NOT EXISTS "catalog_code"          VARCHAR,
        ADD COLUMN IF NOT EXISTS "sub_category"          VARCHAR,
        ADD COLUMN IF NOT EXISTS "item_type"             VARCHAR  NOT NULL DEFAULT 'Standard',
        ADD COLUMN IF NOT EXISTS "stage"                 VARCHAR  NOT NULL DEFAULT 'Production',
        ADD COLUMN IF NOT EXISTS "request_type"          VARCHAR  NOT NULL DEFAULT 'Access',
        ADD COLUMN IF NOT EXISTS "impact"                VARCHAR  NOT NULL DEFAULT 'Medium',
        ADD COLUMN IF NOT EXISTS "urgency"               VARCHAR  NOT NULL DEFAULT 'Medium',
        ADD COLUMN IF NOT EXISTS "default_priority"      VARCHAR  NOT NULL DEFAULT 'P3 - Moderate',
        ADD COLUMN IF NOT EXISTS "approval_required"     BOOLEAN  NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "approval_policy"       VARCHAR,
        ADD COLUMN IF NOT EXISTS "fulfillment_workflow_id" INTEGER
          REFERENCES "workflows"("workflow_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "fulfillment_group_id"  INTEGER
          REFERENCES "assignment_groups"("group_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "assignment_group_id"   INTEGER
          REFERENCES "assignment_groups"("group_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "sla_name"              VARCHAR,
        ADD COLUMN IF NOT EXISTS "service_offering"      VARCHAR,
        ADD COLUMN IF NOT EXISTS "business_service"      VARCHAR,
        ADD COLUMN IF NOT EXISTS "configuration_item"    VARCHAR,
        ADD COLUMN IF NOT EXISTS "tags"                  TEXT[],
        ADD COLUMN IF NOT EXISTS "keywords"              TEXT,
        ADD COLUMN IF NOT EXISTS "banner_url"            VARCHAR,
        ADD COLUMN IF NOT EXISTS "estimated_time"        INTEGER  DEFAULT 2,
        ADD COLUMN IF NOT EXISTS "delivery_time_sla"     INTEGER  DEFAULT 4,
        ADD COLUMN IF NOT EXISTS "allow_requested_for"   BOOLEAN  NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "hide_price"            BOOLEAN  NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "requires_approval_for" BOOLEAN  NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "enable_discussion"     BOOLEAN  NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "available_in_portal"   BOOLEAN  NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "available_in_mobile"   BOOLEAN  NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "show_in_catalog"       BOOLEAN  NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "show_in_popular"       BOOLEAN  NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "allow_requests_for_others" BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "visible_to"            VARCHAR  NOT NULL DEFAULT 'All Users',
        ADD COLUMN IF NOT EXISTS "user_groups"           TEXT[],
        ADD COLUMN IF NOT EXISTS "departments"           TEXT[],
        ADD COLUMN IF NOT EXISTS "locations"             TEXT[],
        ADD COLUMN IF NOT EXISTS "updated_at"            TIMESTAMP NOT NULL DEFAULT now();
    `);

    // ── Extend catalog_variables ──────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "catalog_variables"
        ADD COLUMN IF NOT EXISTS "section_name"    VARCHAR  DEFAULT 'General',
        ADD COLUMN IF NOT EXISTS "placeholder"     VARCHAR,
        ADD COLUMN IF NOT EXISTS "help_text"       VARCHAR,
        ADD COLUMN IF NOT EXISTS "display_order"   INTEGER  NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "is_visible"      BOOLEAN  NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "read_only"       BOOLEAN  NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "min_value"       VARCHAR,
        ADD COLUMN IF NOT EXISTS "max_value"       VARCHAR,
        ADD COLUMN IF NOT EXISTS "validation_regex" VARCHAR;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const catalogCols = [
      "catalog_code","sub_category","item_type","stage","request_type","impact","urgency",
      "default_priority","approval_required","approval_policy","fulfillment_workflow_id",
      "fulfillment_group_id","assignment_group_id","sla_name","service_offering",
      "business_service","configuration_item","tags","keywords","banner_url",
      "estimated_time","delivery_time_sla","allow_requested_for","hide_price",
      "requires_approval_for","enable_discussion","available_in_portal","available_in_mobile",
      "show_in_catalog","show_in_popular","allow_requests_for_others","visible_to",
      "user_groups","departments","locations","updated_at",
    ];
    for (const col of catalogCols) {
      await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "${col}"`);
    }
    const varCols = [
      "section_name","placeholder","help_text","display_order",
      "is_visible","read_only","min_value","max_value","validation_regex",
    ];
    for (const col of varCols) {
      await queryRunner.query(`ALTER TABLE "catalog_variables" DROP COLUMN IF EXISTS "${col}"`);
    }
  }
}
