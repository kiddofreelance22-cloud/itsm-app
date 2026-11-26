import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeManagementCore1794500000000 implements MigrationInterface {
  name = "ChangeManagementCore1794500000000";

  public async up(q: QueryRunner): Promise<void> {
    // Extend the thin legacy "changes" table into a full Request for Change.
    // The legacy "status" column is kept and derived from "state" so older screens keep working.
    await q.query(`
      ALTER TABLE "changes"
        ADD COLUMN "change_type"            VARCHAR(20)  NOT NULL DEFAULT 'Normal',
        ADD COLUMN "state"                  VARCHAR(20)  NOT NULL DEFAULT 'New',
        ADD COLUMN "category"               VARCHAR(100),
        ADD COLUMN "business_service"       VARCHAR(150),
        ADD COLUMN "configuration_items"    JSONB        NOT NULL DEFAULT '[]',
        ADD COLUMN "assignment_group"       VARCHAR(150),
        ADD COLUMN "requested_by"           INTEGER REFERENCES "users"("user_id") ON DELETE SET NULL,
        ADD COLUMN "impact"                 VARCHAR(20),
        ADD COLUMN "urgency"                VARCHAR(20),
        ADD COLUMN "priority"               VARCHAR(20),
        ADD COLUMN "justification"          TEXT,
        ADD COLUMN "risk_answers"           JSONB        NOT NULL DEFAULT '{}',
        ADD COLUMN "risk_score"             INTEGER,
        ADD COLUMN "risk_level"             VARCHAR(20),
        ADD COLUMN "planned_start"          TIMESTAMP,
        ADD COLUMN "planned_end"            TIMESTAMP,
        ADD COLUMN "actual_start"           TIMESTAMP,
        ADD COLUMN "actual_end"             TIMESTAMP,
        ADD COLUMN "causes_outage"          BOOLEAN      NOT NULL DEFAULT false,
        ADD COLUMN "expected_outage"        VARCHAR(100),
        ADD COLUMN "implementation_plan"    TEXT,
        ADD COLUMN "backout_plan"           TEXT,
        ADD COLUMN "test_plan"              TEXT,
        ADD COLUMN "communication_plan"     TEXT,
        ADD COLUMN "implementation_outcome" VARCHAR(30),
        ADD COLUMN "implementation_notes"   TEXT,
        ADD COLUMN "pir"                    JSONB,
        ADD COLUMN "close_code"             VARCHAR(100),
        ADD COLUMN "close_notes"            TEXT,
        ADD COLUMN "related_records"        JSONB        NOT NULL DEFAULT '[]'
    `);
    await q.query(`CREATE INDEX "idx_changes_state" ON "changes" ("state")`);
    await q.query(`CREATE INDEX "idx_changes_planned_window" ON "changes" ("planned_start", "planned_end")`);

    await q.query(`
      CREATE TABLE "change_approvals" (
        "id"             SERIAL PRIMARY KEY,
        "change_id"      INTEGER NOT NULL REFERENCES "changes"("change_id") ON DELETE CASCADE,
        "stage"          INTEGER NOT NULL,
        "approval_group" VARCHAR(150) NOT NULL,
        "rule"           VARCHAR(200),
        "approver_id"    INTEGER REFERENCES "users"("user_id") ON DELETE SET NULL,
        "status"         VARCHAR(20) NOT NULL DEFAULT 'Pending',
        "comment"        TEXT,
        "decided_at"     TIMESTAMP,
        "created_at"     TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX "idx_change_approvals_change" ON "change_approvals" ("change_id")`);
    await q.query(`CREATE INDEX "idx_change_approvals_status" ON "change_approvals" ("status")`);

    await q.query(`
      CREATE TABLE "change_tasks" (
        "id"                SERIAL PRIMARY KEY,
        "change_id"         INTEGER NOT NULL REFERENCES "changes"("change_id") ON DELETE CASCADE,
        "task_code"         VARCHAR(20) NOT NULL,
        "short_description" VARCHAR(255) NOT NULL,
        "assignment_group"  VARCHAR(150),
        "assigned_to"       INTEGER REFERENCES "users"("user_id") ON DELETE SET NULL,
        "state"             VARCHAR(20) NOT NULL DEFAULT 'Open',
        "created_at"        TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX "idx_change_tasks_change" ON "change_tasks" ("change_id")`);

    await q.query(`
      CREATE TABLE "change_work_notes" (
        "id"         SERIAL PRIMARY KEY,
        "change_id"  INTEGER NOT NULL REFERENCES "changes"("change_id") ON DELETE CASCADE,
        "author_id"  INTEGER REFERENCES "users"("user_id") ON DELETE SET NULL,
        "note"       TEXT NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX "idx_change_work_notes_change" ON "change_work_notes" ("change_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "change_work_notes"`);
    await q.query(`DROP TABLE IF EXISTS "change_tasks"`);
    await q.query(`DROP TABLE IF EXISTS "change_approvals"`);
    await q.query(`DROP INDEX IF EXISTS "idx_changes_planned_window"`);
    await q.query(`DROP INDEX IF EXISTS "idx_changes_state"`);
    for (const c of ["change_type","state","category","business_service","configuration_items","assignment_group","requested_by","impact","urgency","priority","justification","risk_answers","risk_score","risk_level","planned_start","planned_end","actual_start","actual_end","causes_outage","expected_outage","implementation_plan","backout_plan","test_plan","communication_plan","implementation_outcome","implementation_notes","pir","close_code","close_notes","related_records"]) {
      await q.query(`ALTER TABLE "changes" DROP COLUMN IF EXISTS "${c}"`);
    }
  }
}
