import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Group and parallel approvals.
 *  - approval_rule: any (default, one decision settles the level) | majority | all
 *  - approvers: for approver_type 'parallel', the list of approvers asked at the same time
 *  - request_approval_votes: one row per approver slot that has answered on a request level
 */
export class ApprovalRulesAndVotes1793300000000 implements MigrationInterface {
  name = "ApprovalRulesAndVotes1793300000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "approval_levels" ADD COLUMN IF NOT EXISTS "approval_rule" varchar(10) NOT NULL DEFAULT 'any', ADD COLUMN IF NOT EXISTS "approvers" jsonb`);
    await q.query(`ALTER TABLE "request_approvals" ADD COLUMN IF NOT EXISTS "approval_rule" varchar(10) NOT NULL DEFAULT 'any', ADD COLUMN IF NOT EXISTS "approvers" jsonb`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "request_approval_votes" (
        "vote_id" SERIAL PRIMARY KEY,
        "request_approval_id" integer NOT NULL REFERENCES "request_approvals"("request_approval_id") ON DELETE CASCADE,
        "slot" varchar(40) NOT NULL,
        "user_id" integer NOT NULL REFERENCES "users"("user_id") ON DELETE CASCADE,
        "decision" varchar(10) NOT NULL,
        "comments" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "uq_approval_vote_slot" UNIQUE ("request_approval_id", "slot")
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "request_approval_votes"`);
    await q.query(`ALTER TABLE "request_approvals" DROP COLUMN IF EXISTS "approvers", DROP COLUMN IF EXISTS "approval_rule"`);
    await q.query(`ALTER TABLE "approval_levels" DROP COLUMN IF EXISTS "approvers", DROP COLUMN IF EXISTS "approval_rule"`);
  }
}
