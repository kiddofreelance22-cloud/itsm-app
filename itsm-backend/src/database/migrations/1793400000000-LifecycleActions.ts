import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Lifecycle actions.
 *  - on_approve / approve_arg: what happens when a level is approved
 *      next (default) | fulfil | step | notify | priority | assign | reroute | task
 *  - after_actions: e-mail / update-request steps that follow the level, run when it is approved
 */
export class LifecycleActions1793400000000 implements MigrationInterface {
  name = "LifecycleActions1793400000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "approval_levels" ADD COLUMN IF NOT EXISTS "on_approve" varchar(20) NOT NULL DEFAULT 'next', ADD COLUMN IF NOT EXISTS "approve_arg" varchar(100)`);
    await q.query(`ALTER TABLE "request_approvals" ADD COLUMN IF NOT EXISTS "on_approve" varchar(20) NOT NULL DEFAULT 'next', ADD COLUMN IF NOT EXISTS "approve_arg" varchar(100), ADD COLUMN IF NOT EXISTS "after_actions" jsonb`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "request_approvals" DROP COLUMN IF EXISTS "after_actions", DROP COLUMN IF EXISTS "approve_arg", DROP COLUMN IF EXISTS "on_approve"`);
    await q.query(`ALTER TABLE "approval_levels" DROP COLUMN IF EXISTS "approve_arg", DROP COLUMN IF EXISTS "on_approve"`);
  }
}
