import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Per-level "If rejected" routing for service request lifecycles.
 *  - approval_levels.on_reject / reject_arg: what happens when this level's approver rejects
 *      close (default) | rework | back | escalate | continue
 *  - request_approvals gets a copy of the routing, the lifecycle level it came from, and an is_appeal flag
 *    for levels inserted by an escalation.
 * Levels that used the old refer-back flags are mapped to the matching outcome.
 */
export class ApprovalRejectRouting1793200000000 implements MigrationInterface {
  name = "ApprovalRejectRouting1793200000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "approval_levels" ADD COLUMN IF NOT EXISTS "on_reject" varchar(20) NOT NULL DEFAULT 'close', ADD COLUMN IF NOT EXISTS "reject_arg" varchar(100)`);
    await q.query(`UPDATE "approval_levels" SET "on_reject" = 'rework' WHERE "refer_back_to_requestor" = true AND "on_reject" = 'close'`);
    await q.query(`UPDATE "approval_levels" SET "on_reject" = 'back' WHERE "refer_back_to_previous_approvers" = true AND "on_reject" = 'close'`);
    await q.query(
      `INSERT INTO "request_statuses" ("status_name","stage","color","description","is_system","is_active","display_order")
       SELECT 'Returned','approval','amber','An approver sent the request back to the requester for changes. It resumes approval when the requester resubmits it.',true,true,
              COALESCE((SELECT "display_order" FROM "request_statuses" WHERE "status_name" = 'Pending Approval'), 1)
       WHERE NOT EXISTS (SELECT 1 FROM "request_statuses" WHERE "status_name" = 'Returned')`
    );
    await q.query(`ALTER TABLE "request_approvals" ADD COLUMN IF NOT EXISTS "on_reject" varchar(20) NOT NULL DEFAULT 'close', ADD COLUMN IF NOT EXISTS "reject_arg" varchar(100), ADD COLUMN IF NOT EXISTS "source_level_id" integer, ADD COLUMN IF NOT EXISTS "is_appeal" boolean NOT NULL DEFAULT false`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM "request_statuses" WHERE "status_name" = 'Returned' AND "is_system" = true`);
    await q.query(`ALTER TABLE "request_approvals" DROP COLUMN IF EXISTS "is_appeal", DROP COLUMN IF EXISTS "source_level_id", DROP COLUMN IF EXISTS "reject_arg", DROP COLUMN IF EXISTS "on_reject"`);
    await q.query(`ALTER TABLE "approval_levels" DROP COLUMN IF EXISTS "reject_arg", DROP COLUMN IF EXISTS "on_reject"`);
  }
}
