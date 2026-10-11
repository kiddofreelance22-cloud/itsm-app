import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 1. Checklist templates get a visibility scope (workgroup / status / category) and their task rows.
 * 2. Incidents get a Resolution Code (picked from Configuration > Resolution Code while resolving).
 */
export class ChecklistScopeAndResolutionCode1792500000000 implements MigrationInterface {
  name = "ChecklistScopeAndResolutionCode1792500000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "incident_checklists" ADD COLUMN IF NOT EXISTS "group_id" integer`);
    await q.query(`ALTER TABLE "incident_checklists" ADD COLUMN IF NOT EXISTS "status_name" character varying`);
    await q.query(`ALTER TABLE "incident_checklists" ADD COLUMN IF NOT EXISTS "category_id" integer`);
    await q.query(`ALTER TABLE "incident_checklists" ADD COLUMN IF NOT EXISTS "include_sub_categories" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "incident_checklists" ADD COLUMN IF NOT EXISTS "tasks" jsonb NOT NULL DEFAULT '[]'::jsonb`);
    await q.query(`ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "resolution_code" character varying`);
    await q.query(`ALTER TABLE "notification_rules" ADD COLUMN IF NOT EXISTS "body_format" character varying NOT NULL DEFAULT 'text'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "notification_rules" DROP COLUMN IF EXISTS "body_format"`);
    await q.query(`ALTER TABLE "incidents" DROP COLUMN IF EXISTS "resolution_code"`);
    for (const c of ["tasks", "include_sub_categories", "category_id", "status_name", "group_id"]) {
      await q.query(`ALTER TABLE "incident_checklists" DROP COLUMN IF EXISTS "${c}"`);
    }
  }
}
