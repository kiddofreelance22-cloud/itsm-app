import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEmailOutbox1794200000000 implements MigrationInterface {
  name = "CreateEmailOutbox1794200000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "email_outbox" (
        "id" SERIAL NOT NULL,
        "recipient" varchar NOT NULL,
        "subject" varchar NOT NULL,
        "html" text NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "next_attempt_at" timestamptz NOT NULL DEFAULT now(),
        "last_error" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_outbox" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE INDEX "idx_email_outbox_status_next_attempt_at" ON "email_outbox" ("status", "next_attempt_at")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_email_outbox_status_next_attempt_at"`);
    await q.query(`DROP TABLE IF EXISTS "email_outbox"`);
  }
}
