import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase A of the Service Request module: lifecycle columns on `requests`,
 * a stored request number, a request-specific priority matrix (urgency x
 * service impact), approval-chain / task / approver-group tables and a
 * catalog `estimated_cost`.
 *
 * Request statuses are intentionally NOT inserted into the shared `statuses`
 * table: GET /status is consumed unfiltered by incident screens. See
 * requests/request-status.constants.ts.
 */
export class ServiceRequestLifecycleFoundation1793000000000 implements MigrationInterface {
  name = "ServiceRequestLifecycleFoundation1793000000000";

  public async up(q: QueryRunner): Promise<void> {
    // ── Catalog cost ────────────────────────────────────────────────────
    await q.query(`ALTER TABLE "catalogs" ADD COLUMN IF NOT EXISTS "estimated_cost" numeric(12,2)`);

    // ── Request columns ─────────────────────────────────────────────────
    await q.query(`
      ALTER TABLE "requests"
        ADD COLUMN IF NOT EXISTS "request_number" varchar(20),
        ADD COLUMN IF NOT EXISTS "submitted_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "urgency_id" integer REFERENCES "urgencies"("urgency_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "service_impact_id" integer REFERENCES "service_impacts"("service_impact_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "priority_id" integer REFERENCES "priorities"("priority_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "assignment_group_id" integer REFERENCES "assignment_groups"("group_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "assigned_to" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "claimed_at" timestamp,
        ADD COLUMN IF NOT EXISTS "sla_service_window_id" integer REFERENCES "sla_service_windows"("sla_service_window_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "sla_response_target" timestamp,
        ADD COLUMN IF NOT EXISTS "sla_fulfilment_target" timestamp,
        ADD COLUMN IF NOT EXISTS "sla_response_met" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "sla_breached" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "sla_paused_at" timestamp,
        ADD COLUMN IF NOT EXISTS "sla_warning_sent" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "pending_reason_id" integer REFERENCES "pending_reasons"("pending_reason_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "hold_notes" text,
        ADD COLUMN IF NOT EXISTS "closure_code_id" integer REFERENCES "closure_codes"("closure_code_id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "fulfilment_notes" text,
        ADD COLUMN IF NOT EXISTS "fulfilled_at" timestamp,
        ADD COLUMN IF NOT EXISTS "estimated_cost" numeric(12,2),
        ADD COLUMN IF NOT EXISTS "feedback_rating" integer,
        ADD COLUMN IF NOT EXISTS "feedback_comment" text,
        ADD COLUMN IF NOT EXISTS "feedback_submitted_at" timestamp
    `);

    // ── Request number: REQ00000012. Existing rows keep the number the UI
    // already displayed (REQ + zero-padded id); new rows draw from a sequence.
    await q.query(`CREATE SEQUENCE IF NOT EXISTS "request_number_seq"`);
    await q.query(`UPDATE "requests" SET "request_number" = 'REQ' || LPAD("request_id"::text, 8, '0') WHERE "request_number" IS NULL`);
    await q.query(`SELECT setval('request_number_seq', COALESCE((SELECT MAX("request_id") FROM "requests"), 0) + 1, false)`);
    await q.query(`ALTER TABLE "requests" ALTER COLUMN "request_number" SET DEFAULT ('REQ' || LPAD(nextval('request_number_seq')::text, 8, '0'))`);
    await q.query(`ALTER TABLE "requests" ALTER COLUMN "request_number" SET NOT NULL`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_requests_request_number" ON "requests" ("request_number")`);

    // ── Cancelled used to be stored as Closed; relabel using the history ─
    await q.query(`
      UPDATE "requests" SET "status" = 'Cancelled'
      WHERE "status" = 'Closed'
        AND "request_id" IN (SELECT "request_id" FROM "request_history" WHERE "action" = 'Cancelled')
    `);

    // ── Request priority matrix (urgency x SERVICE impact -> priority) ──
    await q.query(`
      CREATE TABLE IF NOT EXISTS "request_priority_matrices" (
        "request_priority_matrix_id" SERIAL PRIMARY KEY,
        "urgency_id" integer NOT NULL REFERENCES "urgencies"("urgency_id") ON DELETE RESTRICT,
        "service_impact_id" integer NOT NULL REFERENCES "service_impacts"("service_impact_id") ON DELETE RESTRICT,
        "priority_id" integer NOT NULL REFERENCES "priorities"("priority_id") ON DELETE RESTRICT,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "uq_request_priority_matrix" UNIQUE ("urgency_id", "service_impact_id")
      )
    `);

    // ── Approver groups ─────────────────────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "approver_groups" (
        "approver_group_id" SERIAL PRIMARY KEY,
        "group_name" varchar(150) NOT NULL UNIQUE,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "approver_group_members" (
        "approver_group_id" integer NOT NULL REFERENCES "approver_groups"("approver_group_id") ON DELETE CASCADE,
        "user_id" integer NOT NULL REFERENCES "users"("user_id") ON DELETE CASCADE,
        PRIMARY KEY ("approver_group_id", "user_id")
      )
    `);

    // ── Per-request approval chain ──────────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "request_approvals" (
        "request_approval_id" SERIAL PRIMARY KEY,
        "request_id" integer NOT NULL REFERENCES "requests"("request_id") ON DELETE CASCADE,
        "level_number" integer NOT NULL,
        "title" varchar(150) NOT NULL,
        "approver_type" varchar(20) NOT NULL,
        "approver_ref" integer,
        "status" varchar(20) NOT NULL DEFAULT 'Pending',
        "acted_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "acted_at" timestamp,
        "comments" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "uq_request_approval_level" UNIQUE ("request_id", "level_number")
      )
    `);

    // ── Per-request fulfilment tasks ────────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "request_tasks" (
        "request_task_id" SERIAL PRIMARY KEY,
        "request_id" integer NOT NULL REFERENCES "requests"("request_id") ON DELETE CASCADE,
        "workflow_task_id" integer REFERENCES "workflow_tasks"("workflow_task_id") ON DELETE SET NULL,
        "task_name" varchar(255) NOT NULL,
        "description" text,
        "assignee_type" varchar(20),
        "assignee_id" integer,
        "status" varchar(20) NOT NULL DEFAULT 'Open',
        "priority" varchar(20) NOT NULL DEFAULT 'medium',
        "sort_order" integer NOT NULL DEFAULT 0,
        "due_at" timestamp,
        "completed_at" timestamp,
        "completed_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await q.query(`CREATE INDEX IF NOT EXISTS "idx_requests_status" ON "requests" ("status")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_requests_assignment_group" ON "requests" ("assignment_group_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_requests_assigned_to" ON "requests" ("assigned_to")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_request_approvals_request" ON "request_approvals" ("request_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_request_tasks_request" ON "request_tasks" ("request_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "request_tasks"`);
    await q.query(`DROP TABLE IF EXISTS "request_approvals"`);
    await q.query(`DROP TABLE IF EXISTS "approver_group_members"`);
    await q.query(`DROP TABLE IF EXISTS "approver_groups"`);
    await q.query(`DROP TABLE IF EXISTS "request_priority_matrices"`);
    await q.query(`UPDATE "requests" SET "status" = 'Closed' WHERE "status" = 'Cancelled'`);
    await q.query(`DROP INDEX IF EXISTS "uq_requests_request_number"`);
    await q.query(`
      ALTER TABLE "requests"
        DROP COLUMN IF EXISTS "request_number", DROP COLUMN IF EXISTS "submitted_by",
        DROP COLUMN IF EXISTS "urgency_id", DROP COLUMN IF EXISTS "service_impact_id",
        DROP COLUMN IF EXISTS "priority_id", DROP COLUMN IF EXISTS "assignment_group_id",
        DROP COLUMN IF EXISTS "assigned_to", DROP COLUMN IF EXISTS "claimed_at",
        DROP COLUMN IF EXISTS "sla_service_window_id", DROP COLUMN IF EXISTS "sla_response_target",
        DROP COLUMN IF EXISTS "sla_fulfilment_target", DROP COLUMN IF EXISTS "sla_response_met",
        DROP COLUMN IF EXISTS "sla_breached", DROP COLUMN IF EXISTS "sla_paused_at",
        DROP COLUMN IF EXISTS "sla_warning_sent", DROP COLUMN IF EXISTS "pending_reason_id",
        DROP COLUMN IF EXISTS "hold_notes", DROP COLUMN IF EXISTS "closure_code_id",
        DROP COLUMN IF EXISTS "fulfilment_notes", DROP COLUMN IF EXISTS "fulfilled_at",
        DROP COLUMN IF EXISTS "estimated_cost", DROP COLUMN IF EXISTS "feedback_rating",
        DROP COLUMN IF EXISTS "feedback_comment", DROP COLUMN IF EXISTS "feedback_submitted_at"
    `);
    await q.query(`DROP SEQUENCE IF EXISTS "request_number_seq"`);
    await q.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "estimated_cost"`);
  }
}
