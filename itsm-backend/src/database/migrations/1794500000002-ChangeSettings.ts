import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeSettings1794500000002 implements MigrationInterface {
  name = "ChangeSettings1794500000002";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "change_settings" (
        "setting_key" VARCHAR(50) PRIMARY KEY,
        "value"       JSONB NOT NULL,
        "updated_by"  INTEGER,
        "updated_at"  TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE TABLE "change_notification_log" ("dedupe_key" VARCHAR(150) PRIMARY KEY, "sent_at" TIMESTAMP NOT NULL DEFAULT now())`);
    await q.query(`ALTER TABLE "changes" ADD COLUMN "template_id" VARCHAR(50)`);
    // Status 'Not required' is used for approval rows closed once a stage's rule is satisfied.
    await q.query(`CREATE INDEX "idx_change_approvals_stage" ON "change_approvals" ("change_id", "stage")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_change_approvals_stage"`);
    await q.query(`ALTER TABLE "changes" DROP COLUMN IF EXISTS "template_id"`);
    await q.query(`DROP TABLE IF EXISTS "change_notification_log"`);
    await q.query(`DROP TABLE IF EXISTS "change_settings"`);
  }
}
