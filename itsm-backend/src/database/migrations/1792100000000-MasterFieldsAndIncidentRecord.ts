import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Closes the gaps between the Design boards and the original schema:
 *  - description / display order / colour / SLA impact on the generic masters
 *  - Status version history (every rename or edit is versioned)
 *  - Incident Record: required flag on checklist items, per-incident checklist progress,
 *    related-item links, contact type / caller e-mail / "logged by" on incidents
 *  - Roles: navigation access (visible / can-create per menu item)
 * Idempotent; safe to re-run.
 */
export class MasterFieldsAndIncidentRecord1792100000000 implements MigrationInterface {
  name = "MasterFieldsAndIncidentRecord1792100000000";

  public async up(q: QueryRunner): Promise<void> {
    // ── Generic masters ────────────────────────────────────────────────────
    await q.query(`ALTER TABLE "closure_codes" ADD COLUMN IF NOT EXISTS "description" text`);
    await q.query(`ALTER TABLE "closure_codes" ADD COLUMN IF NOT EXISTS "display_order" integer NOT NULL DEFAULT 0`);
    await q.query(`UPDATE "closure_codes" SET "display_order" = sub.rn FROM
      (SELECT closure_code_id, row_number() OVER (ORDER BY closure_code_id) rn FROM "closure_codes") sub
      WHERE "closure_codes".closure_code_id = sub.closure_code_id AND "closure_codes"."display_order" = 0`);

    await q.query(`ALTER TABLE "pending_reasons" ADD COLUMN IF NOT EXISTS "description" text`);
    await q.query(`ALTER TABLE "pending_reasons" ADD COLUMN IF NOT EXISTS "display_order" integer NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "pending_reasons" ADD COLUMN IF NOT EXISTS "sla_impact" character varying(10) NOT NULL DEFAULT 'pause'`);
    await q.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_pending_reasons_sla_impact') THEN
        ALTER TABLE "pending_reasons" ADD CONSTRAINT "ck_pending_reasons_sla_impact" CHECK ("sla_impact" IN ('pause','continue'));
      END IF; END $$`);
    await q.query(`UPDATE "pending_reasons" SET "display_order" = sub.rn FROM
      (SELECT pending_reason_id, row_number() OVER (ORDER BY pending_reason_id) rn FROM "pending_reasons") sub
      WHERE "pending_reasons".pending_reason_id = sub.pending_reason_id AND "pending_reasons"."display_order" = 0`);

    for (const t of ["impacts", "urgencies", "priorities"]) {
      await q.query(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "description" text`);
      await q.query(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "color" character varying(20)`);
    }

    await q.query(`ALTER TABLE "sla_service_windows" ADD COLUMN IF NOT EXISTS "description" text`);
    await q.query(`ALTER TABLE "sla_service_windows" ADD COLUMN IF NOT EXISTS "display_order" integer NOT NULL DEFAULT 0`);

    // ── Status: description, order, version history ────────────────────────
    await q.query(`ALTER TABLE "statuses" ADD COLUMN IF NOT EXISTS "description" text`);
    await q.query(`ALTER TABLE "statuses" ADD COLUMN IF NOT EXISTS "display_order" integer NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "statuses" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1`);
    await q.query(`UPDATE "statuses" SET "display_order" = sub.rn FROM
      (SELECT status_id, row_number() OVER (ORDER BY status_id) rn FROM "statuses") sub
      WHERE "statuses".status_id = sub.status_id AND "statuses"."display_order" = 0`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "status_versions" (
        "version_id" SERIAL PRIMARY KEY,
        "status_id" integer NOT NULL REFERENCES "statuses"("status_id") ON DELETE CASCADE,
        "version" integer NOT NULL,
        "label" character varying(300) NOT NULL,
        "status_name" character varying(100) NOT NULL,
        "modified_by" character varying(150) NOT NULL DEFAULT 'System',
        "modified_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_status_versions" UNIQUE ("status_id","version")
      )`);
    await q.query(`INSERT INTO "status_versions" ("status_id","version","label","status_name","modified_by")
      SELECT status_id, 1, 'Created', status_name, 'System' FROM "statuses" s
      WHERE NOT EXISTS (SELECT 1 FROM "status_versions" v WHERE v.status_id = s.status_id)`);

    // ── Incident record: checklist, links, contact fields ──────────────────
    await q.query(`ALTER TABLE "incident_wo_checklist_items" ADD COLUMN IF NOT EXISTS "is_required" boolean NOT NULL DEFAULT false`);
    await q.query(`UPDATE "incident_wo_checklist_items" SET "is_required" = true
      WHERE "name" IN ('Confirm Affected CI','Verify User Identity','Attach Diagnostic Logs')`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "incident_checklist_progress" (
        "incident_id" character varying NOT NULL REFERENCES "incidents"("incident_id") ON DELETE CASCADE,
        "item_id" integer NOT NULL REFERENCES "incident_wo_checklist_items"("id") ON DELETE CASCADE,
        "done" boolean NOT NULL DEFAULT false,
        "done_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "done_at" TIMESTAMP,
        PRIMARY KEY ("incident_id","item_id")
      )`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "incident_links" (
        "link_id" SERIAL PRIMARY KEY,
        "incident_id" character varying NOT NULL REFERENCES "incidents"("incident_id") ON DELETE CASCADE,
        "linked_incident_id" character varying NOT NULL REFERENCES "incidents"("incident_id") ON DELETE CASCADE,
        "created_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "ck_incident_links_distinct" CHECK ("incident_id" <> "linked_incident_id"),
        CONSTRAINT "uq_incident_links" UNIQUE ("incident_id","linked_incident_id")
      )`);

    await q.query(`ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "contact_type" character varying(40)`);
    await q.query(`ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "caller_email" character varying(200)`);
    await q.query(`ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "logged_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL`);

    await q.query(`ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "display_order" integer NOT NULL DEFAULT 0`);
    await q.query(`UPDATE "roles" SET "display_order" = sub.rn FROM
      (SELECT role_id, row_number() OVER (ORDER BY role_id) rn FROM "roles") sub
      WHERE "roles".role_id = sub.role_id AND "roles"."display_order" = 0`);

    // ── Role navigation access ─────────────────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "role_navigation_access" (
        "role_id" integer NOT NULL REFERENCES "roles"("role_id") ON DELETE CASCADE,
        "nav_key" character varying(120) NOT NULL,
        "visible" boolean NOT NULL DEFAULT false,
        "can_create" boolean NOT NULL DEFAULT false,
        PRIMARY KEY ("role_id","nav_key"),
        CONSTRAINT "ck_role_nav_create_needs_visible" CHECK ("can_create" = false OR "visible" = true)
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "role_navigation_access"`);
    await q.query(`ALTER TABLE "roles" DROP COLUMN IF EXISTS "display_order"`);
    await q.query(`ALTER TABLE "sla_service_windows" DROP COLUMN IF EXISTS "display_order"`);
    await q.query(`ALTER TABLE "sla_service_windows" DROP COLUMN IF EXISTS "description"`);
    for (const c of ["logged_by", "caller_email", "contact_type"]) await q.query(`ALTER TABLE "incidents" DROP COLUMN IF EXISTS "${c}"`);
    await q.query(`DROP TABLE IF EXISTS "incident_links"`);
    await q.query(`DROP TABLE IF EXISTS "incident_checklist_progress"`);
    await q.query(`ALTER TABLE "incident_wo_checklist_items" DROP COLUMN IF EXISTS "is_required"`);
    await q.query(`DROP TABLE IF EXISTS "status_versions"`);
    for (const c of ["version", "display_order", "description"]) await q.query(`ALTER TABLE "statuses" DROP COLUMN IF EXISTS "${c}"`);
    for (const t of ["impacts", "urgencies", "priorities"]) {
      await q.query(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "color"`);
      await q.query(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "description"`);
    }
    await q.query(`ALTER TABLE "pending_reasons" DROP CONSTRAINT IF EXISTS "ck_pending_reasons_sla_impact"`);
    for (const c of ["sla_impact", "display_order", "description"]) await q.query(`ALTER TABLE "pending_reasons" DROP COLUMN IF EXISTS "${c}"`);
    for (const c of ["display_order", "description"]) await q.query(`ALTER TABLE "closure_codes" DROP COLUMN IF EXISTS "${c}"`);
  }
}
