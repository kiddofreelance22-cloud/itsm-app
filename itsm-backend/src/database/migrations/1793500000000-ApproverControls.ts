import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Approver controls on each approval step:
 *  - comment_policy: optional | reject (default: needed to reject or ask for information) | both
 *  - allow_reject / allow_info / allow_delegate
 *  - remind_days / timeout_days / on_timeout (escalate | approve | reject) / timeout_arg ("<type>:<id>")
 * request_approvals also records when a level started waiting and when it was last reminded.
 * request_history.action_by becomes optional so automatic actions (timeouts) are recorded as "System".
 */
export class ApproverControls1793500000000 implements MigrationInterface {
  name = "ApproverControls1793500000000";

  public async up(q: QueryRunner): Promise<void> {
    const cols = `ADD COLUMN IF NOT EXISTS "comment_policy" varchar(10) NOT NULL DEFAULT 'reject',
      ADD COLUMN IF NOT EXISTS "allow_reject" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "allow_info" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "allow_delegate" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "remind_days" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "timeout_days" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "on_timeout" varchar(10) NOT NULL DEFAULT 'escalate',
      ADD COLUMN IF NOT EXISTS "timeout_arg" varchar(100)`;
    await q.query(`ALTER TABLE "approval_levels" ${cols}`);
    await q.query(`ALTER TABLE "request_approvals" ${cols}, ADD COLUMN IF NOT EXISTS "pending_since" timestamp, ADD COLUMN IF NOT EXISTS "reminded_at" timestamp`);
    await q.query(`ALTER TABLE "request_history" ALTER COLUMN "action_by" DROP NOT NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "request_approvals" DROP COLUMN IF EXISTS "reminded_at", DROP COLUMN IF EXISTS "pending_since"`);
    for (const t of ["request_approvals", "approval_levels"]) {
      await q.query(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "timeout_arg", DROP COLUMN IF EXISTS "on_timeout", DROP COLUMN IF EXISTS "timeout_days", DROP COLUMN IF EXISTS "remind_days", DROP COLUMN IF EXISTS "allow_delegate", DROP COLUMN IF EXISTS "allow_info", DROP COLUMN IF EXISTS "allow_reject", DROP COLUMN IF EXISTS "comment_policy"`);
    }
    // action_by stays optional: rows written by the system have no user.
  }
}
