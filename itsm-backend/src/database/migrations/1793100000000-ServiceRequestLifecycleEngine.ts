import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phases B-E of the Service Request module.
 *  - catalogs.service_impact_id (default service impact per catalog item)
 *  - service_impacts.description (so the generic master screen can edit it)
 *  - requests.sub_status / auto_close_at / sla_started_at
 *  - request_statuses (stages + custom statuses) seeded with the system statuses
 *  - request_notification_rules (empty: administrators create their own rules)
 *  - relabels legacy rows to the new lifecycle (see comments)
 */
export class ServiceRequestLifecycleEngine1793100000000 implements MigrationInterface {
  name = "ServiceRequestLifecycleEngine1793100000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "catalogs" ADD COLUMN IF NOT EXISTS "service_impact_id" integer REFERENCES "service_impacts"("service_impact_id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "service_impacts" ADD COLUMN IF NOT EXISTS "description" text`);
    await q.query(`ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "sub_status" varchar(100), ADD COLUMN IF NOT EXISTS "auto_close_at" timestamp, ADD COLUMN IF NOT EXISTS "sla_started_at" timestamp`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_requests_auto_close" ON "requests" ("auto_close_at") WHERE "status" = 'Fulfilled'`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "request_statuses" (
        "request_status_id" SERIAL PRIMARY KEY,
        "status_name" varchar(100) NOT NULL UNIQUE,
        "description" text,
        "stage" varchar(20) NOT NULL,
        "color" varchar(20) NOT NULL DEFAULT 'gray',
        "is_system" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "display_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    const system: Array<[string, string, string, string, string]> = [
      ["Pending Approval", "approval", "amber", "A request enters this status when it is submitted with approvals to collect.", "1"],
      ["Approved", "queue", "blue", "A request enters this status when its last approval is given, or straight away when no approval is needed. It waits here for an agent to take it.", "2"],
      ["In Progress", "work", "violet", "A request enters this status when an agent takes it from the queue or resumes it from hold.", "3"],
      ["On Hold", "hold", "gray", "A request enters this status when an agent puts it on hold without choosing one of the custom On hold statuses.", "4"],
      ["Fulfilled", "done", "green", "A request enters this status when the agent marks it fulfilled. The requester then confirms, or it closes automatically after the configured number of business days.", "5"],
      ["Closed", "closed", "dark", "A request enters this status when the requester confirms delivery, or automatically after fulfilment.", "6"],
      ["Rejected", "stopped", "red", "A request enters this status when an approver rejects it.", "7"],
      ["Cancelled", "stopped", "gray", "A request enters this status when the requester cancels it before fulfilment starts.", "8"],
    ];
    for (const [name, stage, color, desc, order] of system) {
      await q.query(
        `INSERT INTO "request_statuses" ("status_name","stage","color","description","is_system","is_active","display_order")
         SELECT $1::varchar,$2::varchar,$3::varchar,$4::text,true,true,$5::int WHERE NOT EXISTS (SELECT 1 FROM "request_statuses" WHERE "status_name" = $1::varchar)`,
        [name, stage, color, desc, Number(order)]
      );
    }

    await q.query(`
      CREATE TABLE IF NOT EXISTS "request_notification_rules" (
        "rule_id" SERIAL PRIMARY KEY,
        "rule_name" varchar(150) NOT NULL,
        "event_key" varchar(40) NOT NULL,
        "recipients" text[] NOT NULL DEFAULT '{}',
        "subject" varchar(250) NOT NULL,
        "body" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "display_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    // Legacy rows -> new lifecycle. In the old model "Approved" was terminal and
    // "In Progress" meant "sitting at an approval step".
    await q.query(`UPDATE "requests" SET "status" = 'Closed' WHERE "status" = 'Approved' AND "closed_at" IS NOT NULL`);
    await q.query(`UPDATE "requests" SET "status" = 'Approved' WHERE "status" = 'Submitted'`);
    await q.query(`
      UPDATE "requests" SET "status" = 'Pending Approval'
      WHERE "status" = 'In Progress'
        AND "current_step_id" IN (SELECT "workflow_step_id" FROM "workflow_steps" WHERE "approver_role_id" IS NOT NULL)
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // The legacy status relabel in up() is not reversed: it cannot be told apart
    // from rows created under the new lifecycle.
    await q.query(`DROP TABLE IF EXISTS "request_notification_rules"`);
    await q.query(`DROP TABLE IF EXISTS "request_statuses"`);
    await q.query(`DROP INDEX IF EXISTS "idx_requests_auto_close"`);
    await q.query(`ALTER TABLE "requests" DROP COLUMN IF EXISTS "sub_status", DROP COLUMN IF EXISTS "auto_close_at", DROP COLUMN IF EXISTS "sla_started_at"`);
    await q.query(`ALTER TABLE "service_impacts" DROP COLUMN IF EXISTS "description"`);
    await q.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "service_impact_id"`);
  }
}
