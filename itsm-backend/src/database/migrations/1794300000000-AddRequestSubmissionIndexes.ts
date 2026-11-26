import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRequestSubmissionIndexes1794300000000 implements MigrationInterface {
  name = "AddRequestSubmissionIndexes1794300000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_request_variable_values_request" ON "request_variable_values" ("request_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_request_history_request" ON "request_history" ("request_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_requests_requested_by_created_at" ON "requests" ("requested_by", "created_at" DESC)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_requests_requested_by_created_at"`);
    await q.query(`DROP INDEX IF EXISTS "idx_request_history_request"`);
    await q.query(`DROP INDEX IF EXISTS "idx_request_variable_values_request"`);
  }
}
