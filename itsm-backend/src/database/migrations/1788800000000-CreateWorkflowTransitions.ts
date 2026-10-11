import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWorkflowTransitions1788800000000 implements MigrationInterface {
  name = "CreateWorkflowTransitions1788800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workflow_steps"
      ADD COLUMN "condition_expression" TEXT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "workflow_transitions" (
        "transition_id" SERIAL NOT NULL,
        "workflow_id" INTEGER NOT NULL,
        "from_step_id" INTEGER NOT NULL,
        "to_step_id" INTEGER NOT NULL,
        "branch" VARCHAR(3) NOT NULL,
        CONSTRAINT "PK_workflow_transitions" PRIMARY KEY ("transition_id"),
        CONSTRAINT "UQ_workflow_transition_branch" UNIQUE ("from_step_id", "branch"),
        CONSTRAINT "FK_workflow_transition_workflow" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("workflow_id") ON DELETE CASCADE,
        CONSTRAINT "FK_workflow_transition_from" FOREIGN KEY ("from_step_id") REFERENCES "workflow_steps"("workflow_step_id") ON DELETE CASCADE,
        CONSTRAINT "FK_workflow_transition_to" FOREIGN KEY ("to_step_id") REFERENCES "workflow_steps"("workflow_step_id") ON DELETE CASCADE,
        CONSTRAINT "CHK_workflow_transition_branch" CHECK ("branch" IN ('yes', 'no'))
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_workflow_transitions_workflow" ON "workflow_transitions" ("workflow_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_workflow_transitions_workflow"`);
    await queryRunner.query(`DROP TABLE "workflow_transitions"`);
    await queryRunner.query(`ALTER TABLE "workflow_steps" DROP COLUMN "condition_expression"`);
  }
}