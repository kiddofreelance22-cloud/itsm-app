import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeLifecycleExecution1794600000000 implements MigrationInterface {
  name = "ChangeLifecycleExecution1794600000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "changes" ADD COLUMN "lifecycle_steps" JSONB`);
    await q.query(`ALTER TABLE "changes" ADD COLUMN "lifecycle_step_index" INTEGER`);
    await q.query(`ALTER TABLE "changes" ADD COLUMN "lifecycle_wait_until" TIMESTAMP`);
    await q.query(`CREATE INDEX "idx_changes_lifecycle_wait" ON "changes" ("lifecycle_wait_until") WHERE "lifecycle_wait_until" IS NOT NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_changes_lifecycle_wait"`);
    await q.query(`ALTER TABLE "changes" DROP COLUMN IF EXISTS "lifecycle_wait_until"`);
    await q.query(`ALTER TABLE "changes" DROP COLUMN IF EXISTS "lifecycle_step_index"`);
    await q.query(`ALTER TABLE "changes" DROP COLUMN IF EXISTS "lifecycle_steps"`);
  }
}
