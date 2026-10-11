import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkflowStepNodeMeta1790400000000 implements MigrationInterface {
  name = "AddWorkflowStepNodeMeta1790400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workflow_steps"
      ADD COLUMN IF NOT EXISTS "node_kind" varchar(64),
      ADD COLUMN IF NOT EXISTS "config" jsonb,
      ADD COLUMN IF NOT EXISTS "position_x" double precision,
      ADD COLUMN IF NOT EXISTS "position_y" double precision
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workflow_steps"
      DROP COLUMN IF EXISTS "node_kind",
      DROP COLUMN IF EXISTS "config",
      DROP COLUMN IF EXISTS "position_x",
      DROP COLUMN IF EXISTS "position_y"
    `);
  }
}
