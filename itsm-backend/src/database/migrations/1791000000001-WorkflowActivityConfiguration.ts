import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Creates detailed configuration tables for workflow activities:
 * - approval_levels: For approval step configuration (multiple levels, approvers, auto-approval, etc.)
 * - workflow_tasks: For task step configuration (task details, assignees, due dates, checklists)
 * - workflow_notifications: For notification step configuration (recipients, subjects, bodies, triggers)
 * - workflow_conditions: For condition step configuration (expressions, true/false paths)
 */
export class WorkflowActivityConfiguration1791000000001 implements MigrationInterface {
  name = "WorkflowActivityConfiguration1791000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Approval levels table ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "approval_levels" (
        "approval_level_id" SERIAL NOT NULL,
        "activity_id" INTEGER NOT NULL REFERENCES "workflow_steps"("workflow_step_id") ON DELETE CASCADE,
        "level_number" INTEGER NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "approver_type" VARCHAR(20) NOT NULL,
        "approver_id" INTEGER,
        "auto_approval" BOOLEAN NOT NULL DEFAULT false,
        "email_notifications_for_end_user" BOOLEAN NOT NULL DEFAULT false,
        "refer_back_to_requestor" BOOLEAN NOT NULL DEFAULT false,
        "refer_back_to_previous_approvers" BOOLEAN NOT NULL DEFAULT false,
        "custom_group_id" INTEGER REFERENCES "assignment_groups"("group_id") ON DELETE SET NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_approval_levels" PRIMARY KEY ("approval_level_id")
      );
    `);

    // ── Workflow tasks table ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workflow_tasks" (
        "workflow_task_id" SERIAL NOT NULL,
        "activity_id" INTEGER NOT NULL REFERENCES "workflow_steps"("workflow_step_id") ON DELETE CASCADE,
        "task_name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "assignee_type" VARCHAR(20) NOT NULL,
        "assignee_id" INTEGER,
        "due_date_hours" INTEGER,
        "priority" VARCHAR(20) NOT NULL DEFAULT 'medium',
        "checklists" JSONB,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workflow_tasks" PRIMARY KEY ("workflow_task_id")
      );
    `);

    // ── Workflow notifications table ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workflow_notifications" (
        "workflow_notification_id" SERIAL NOT NULL,
        "activity_id" INTEGER NOT NULL REFERENCES "workflow_steps"("workflow_step_id") ON DELETE CASCADE,
        "notification_name" VARCHAR(255) NOT NULL,
        "recipient_type" VARCHAR(20) NOT NULL,
        "recipient_ids" JSONB,
        "subject" VARCHAR(500),
        "body" TEXT,
        "trigger_events" JSONB,
        "attachment_ids" JSONB,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workflow_notifications" PRIMARY KEY ("workflow_notification_id")
      );
    `);

    // ── Workflow conditions table ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workflow_conditions" (
        "workflow_condition_id" SERIAL NOT NULL,
        "activity_id" INTEGER NOT NULL REFERENCES "workflow_steps"("workflow_step_id") ON DELETE CASCADE,
        "condition_name" VARCHAR(255) NOT NULL,
        "expression" TEXT NOT NULL,
        "true_path_activity_id" INTEGER REFERENCES "workflow_steps"("workflow_step_id") ON DELETE SET NULL,
        "false_path_activity_id" INTEGER REFERENCES "workflow_steps"("workflow_step_id") ON DELETE SET NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workflow_conditions" PRIMARY KEY ("workflow_condition_id")
      );
    `);

    // ── Add indexes for performance ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_approval_levels_activity" ON "approval_levels"("activity_id");
      CREATE INDEX IF NOT EXISTS "IDX_workflow_tasks_activity" ON "workflow_tasks"("activity_id");
      CREATE INDEX IF NOT EXISTS "IDX_workflow_notifications_activity" ON "workflow_notifications"("activity_id");
      CREATE INDEX IF NOT EXISTS "IDX_workflow_conditions_activity" ON "workflow_conditions"("activity_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Drop indexes ───────────────────────────────────────────────────────────
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_levels_activity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_tasks_activity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_notifications_activity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_conditions_activity"`);

    // ── Drop tables ───────────────────────────────────────────────────────────
    await queryRunner.query(`DROP TABLE IF EXISTS "workflow_conditions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workflow_notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workflow_tasks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "approval_levels"`);
  }
}
