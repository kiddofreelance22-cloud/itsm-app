import { MigrationInterface, QueryRunner } from "typeorm";

/** Remembers that the "SLA Breach Warning" e-mail was sent, so the minute-by-minute sweep sends it once per target. */
export class SlaWarningFlag1792300000000 implements MigrationInterface {
  name = "SlaWarningFlag1792300000000";
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "sla_warning_sent" boolean NOT NULL DEFAULT false`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "incidents" DROP COLUMN IF EXISTS "sla_warning_sent"`);
  }
}
