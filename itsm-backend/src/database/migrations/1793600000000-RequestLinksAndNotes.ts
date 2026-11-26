import { MigrationInterface, QueryRunner } from "typeorm";

/** Linked tickets and internal work notes on a service request. */
export class RequestLinksAndNotes1793600000000 implements MigrationInterface {
  name = "RequestLinksAndNotes1793600000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "request_links" (
        "link_id" SERIAL PRIMARY KEY,
        "request_id" integer NOT NULL REFERENCES "requests"("request_id") ON DELETE CASCADE,
        "target_type" varchar(20) NOT NULL,
        "target_ref" varchar(60) NOT NULL,
        "relation" varchar(30) NOT NULL DEFAULT 'Related to',
        "title" varchar(300),
        "details" varchar(300),
        "created_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "uq_request_link_target" UNIQUE ("request_id", "target_type", "target_ref")
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_request_links_target" ON "request_links" ("target_type", "target_ref")`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "request_work_notes" (
        "note_id" SERIAL PRIMARY KEY,
        "request_id" integer NOT NULL REFERENCES "requests"("request_id") ON DELETE CASCADE,
        "text" text NOT NULL,
        "created_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_request_work_notes_request" ON "request_work_notes" ("request_id", "created_at")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "request_work_notes"`);
    await q.query(`DROP TABLE IF EXISTS "request_links"`);
  }
}
