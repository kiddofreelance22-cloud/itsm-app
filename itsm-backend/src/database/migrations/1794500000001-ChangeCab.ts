import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeCab1794500000001 implements MigrationInterface {
  name = "ChangeCab1794500000001";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "cab_meetings" (
        "id"           SERIAL PRIMARY KEY,
        "title"        VARCHAR(150) NOT NULL,
        "scheduled_at" TIMESTAMP NOT NULL,
        "location"     VARCHAR(200),
        "chair"        VARCHAR(150),
        "status"       VARCHAR(20) NOT NULL DEFAULT 'Planned',
        "attendance"   JSONB NOT NULL DEFAULT '[]',
        "minutes"      TEXT,
        "started_at"   TIMESTAMP,
        "ended_at"     TIMESTAMP,
        "created_at"   TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX "idx_cab_meetings_scheduled" ON "cab_meetings" ("scheduled_at")`);
    await q.query(`ALTER TABLE "change_approvals" ADD COLUMN "meeting_id" INTEGER REFERENCES "cab_meetings"("id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "changes" ADD COLUMN "cab_reviewed_at" TIMESTAMP`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "changes" DROP COLUMN IF EXISTS "cab_reviewed_at"`);
    await q.query(`ALTER TABLE "change_approvals" DROP COLUMN IF EXISTS "meeting_id"`);
    await q.query(`DROP TABLE IF EXISTS "cab_meetings"`);
  }
}
