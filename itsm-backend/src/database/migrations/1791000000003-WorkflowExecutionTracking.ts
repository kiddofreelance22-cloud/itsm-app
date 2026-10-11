import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Creates workflow execution tracking tables:
 * - service_request_flow_tracking: Tracks the current state of service request workflows
 * - workflow_execution_log: Logs each action taken during workflow execution
 */
export class WorkflowExecutionTracking1791000000003 implements MigrationInterface {
  name = "WorkflowExecutionTracking1791000000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Service request flow tracking table ───────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "service_request_flow_tracking" (
        "tracking_id" SERIAL NOT NULL,
        "service_request_id" INTEGER NOT NULL REFERENCES "requests"("request_id") ON DELETE CASCADE,
        "catalog_id" INTEGER NOT NULL REFERENCES "catalogs"("catalog_id") ON DELETE CASCADE,
        "workflow_id" INTEGER REFERENCES "workflows"("workflow_id") ON DELETE SET NULL,
        "current_activity_id" INTEGER REFERENCES "workflow_steps"("workflow_step_id") ON DELETE SET NULL,
        "current_step" VARCHAR(50) NOT NULL DEFAULT 'in_progress',
        "status" VARCHAR(20) NOT NULL DEFAULT 'in_progress',
        "started_at" TIMESTAMP NOT NULL DEFAULT now(),
        "completed_at" TIMESTAMP,
        "error_message" TEXT,
        "metadata" JSONB,
        CONSTRAINT "PK_service_request_flow_tracking" PRIMARY KEY ("tracking_id")
      );
    `);

    // ── Workflow execution log table ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workflow_execution_log" (
        "execution_log_id" SERIAL NOT NULL,
        "workflow_id" INTEGER NOT NULL REFERENCES "workflows"("workflow_id") ON DELETE CASCADE,
        "service_request_id" INTEGER REFERENCES "requests"("request_id") ON DELETE SET NULL,
        "activity_id" INTEGER REFERENCES "workflow_steps"("workflow_step_id") ON DELETE SET NULL,
        "action" VARCHAR(100) NOT NULL,
        "performed_by_id" INTEGER REFERENCES "users"("user_id") ON DELETE SET NULL,
        "result" VARCHAR(20),
        "error_message" TEXT,
        "execution_time_ms" INTEGER,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workflow_execution_log" PRIMARY KEY ("execution_log_id")
      );
    `);

    // ── Add indexes for performance ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_request_flow_tracking_request" ON "service_request_flow_tracking"("service_request_id");
      CREATE INDEX IF NOT EXISTS "IDX_service_request_flow_tracking_catalog" ON "service_request_flow_tracking"("catalog_id");
      CREATE INDEX IF NOT EXISTS "IDX_service_request_flow_tracking_workflow" ON "service_request_flow_tracking"("workflow_id");
      CREATE INDEX IF NOT EXISTS "IDX_service_request_flow_tracking_status" ON "service_request_flow_tracking"("status");

      CREATE INDEX IF NOT EXISTS "IDX_workflow_execution_log_workflow" ON "workflow_execution_log"("workflow_id");
      CREATE INDEX IF NOT EXISTS "IDX_workflow_execution_log_request" ON "workflow_execution_log"("service_request_id");
      CREATE INDEX IF NOT EXISTS "IDX_workflow_execution_log_activity" ON "workflow_execution_log"("activity_id");
      CREATE INDEX IF NOT EXISTS "IDX_workflow_execution_log_performed_by" ON "workflow_execution_log"("performed_by_id");
      CREATE INDEX IF NOT EXISTS "IDX_workflow_execution_log_created_at" ON "workflow_execution_log"("created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Drop indexes ───────────────────────────────────────────────────────────
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_execution_log_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_execution_log_performed_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_execution_log_activity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_execution_log_request"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_execution_log_workflow"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_request_flow_tracking_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_request_flow_tracking_workflow"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_request_flow_tracking_catalog"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_request_flow_tracking_request"`);

    // ── Drop tables ───────────────────────────────────────────────────────────
    await queryRunner.query(`DROP TABLE IF EXISTS "workflow_execution_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_request_flow_tracking"`);
  }
}
