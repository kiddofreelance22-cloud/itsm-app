import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Lifecycle steps: wait / timer, create related record, integration (webhook / Teams), and the auto-fulfil approve outcome.
 *  - requests.wait_until / deferred_actions: a request paused by a Wait step, and the steps that run when the wait ends
 *  - approve_arg becomes long enough to hold the resolution note of an auto-fulfil
 *  - "Waiting" system status
 */
export class LifecycleSteps1793800000000 implements MigrationInterface {
  name = "LifecycleSteps1793800000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "approval_levels" ALTER COLUMN "approve_arg" TYPE varchar(500)`);
    await q.query(`ALTER TABLE "request_approvals" ALTER COLUMN "approve_arg" TYPE varchar(500)`);
    await q.query(`ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "wait_until" timestamp, ADD COLUMN IF NOT EXISTS "deferred_actions" jsonb`);
    await q.query(
      `INSERT INTO "request_statuses" ("status_name","stage","color","description","is_system","is_active","display_order")
       SELECT 'Waiting','approval','gray','The lifecycle has paused the request for a set time. It carries on by itself when the wait ends.',true,true,
              COALESCE((SELECT "display_order" FROM "request_statuses" WHERE "status_name" = 'Pending Approval'), 1)
       WHERE NOT EXISTS (SELECT 1 FROM "request_statuses" WHERE "status_name" = 'Waiting')`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM "request_statuses" WHERE "status_name" = 'Waiting' AND "is_system" = true`);
    await q.query(`ALTER TABLE "requests" DROP COLUMN IF EXISTS "deferred_actions", DROP COLUMN IF EXISTS "wait_until"`);
    await q.query(`ALTER TABLE "request_approvals" ALTER COLUMN "approve_arg" TYPE varchar(100) USING left("approve_arg", 100)`);
    await q.query(`ALTER TABLE "approval_levels" ALTER COLUMN "approve_arg" TYPE varchar(100) USING left("approve_arg", 100)`);
  }
}
