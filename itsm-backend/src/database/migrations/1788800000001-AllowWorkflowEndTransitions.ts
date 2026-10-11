import { MigrationInterface, QueryRunner } from "typeorm";

export class AllowWorkflowEndTransitions1788800000001 implements MigrationInterface {
  name = "AllowWorkflowEndTransitions1788800000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workflow_transitions" ALTER COLUMN "to_step_id" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "workflow_transitions" WHERE "to_step_id" IS NULL`);
    await queryRunner.query(`ALTER TABLE "workflow_transitions" ALTER COLUMN "to_step_id" SET NOT NULL`);
  }
}