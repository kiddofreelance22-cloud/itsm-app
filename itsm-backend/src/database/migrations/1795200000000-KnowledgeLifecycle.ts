import { MigrationInterface, QueryRunner } from "typeorm";

export class KnowledgeLifecycle1795200000000 implements MigrationInterface {
  name = "KnowledgeLifecycle1795200000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workflows"
      ADD COLUMN "workflow_scope" varchar(30) NOT NULL DEFAULT 'service_request'
    `);
    await queryRunner.query(`
      ALTER TABLE "workflows"
      ADD CONSTRAINT "CHK_workflows_workflow_scope"
      CHECK ("workflow_scope" IN ('service_request', 'knowledge'))
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_articles"
      ADD COLUMN "lifecycle_workflow_id" integer NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_articles"
      ADD CONSTRAINT "FK_knowledge_articles_lifecycle_workflow"
      FOREIGN KEY ("lifecycle_workflow_id") REFERENCES "workflows"("workflow_id")
      ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_articles_lifecycle_workflow_id"
      ON "knowledge_articles" ("lifecycle_workflow_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_articles_lifecycle_workflow_id"`);
    await queryRunner.query(`ALTER TABLE "knowledge_articles" DROP CONSTRAINT IF EXISTS "FK_knowledge_articles_lifecycle_workflow"`);
    await queryRunner.query(`ALTER TABLE "knowledge_articles" DROP COLUMN IF EXISTS "lifecycle_workflow_id"`);
    await queryRunner.query(`ALTER TABLE "workflows" DROP CONSTRAINT IF EXISTS "CHK_workflows_workflow_scope"`);
    await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "workflow_scope"`);
  }
}
