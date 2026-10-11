import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkflowMetadata1791100000000 implements MigrationInterface {
  name = "AddWorkflowMetadata1791100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workflows"
      ADD COLUMN IF NOT EXISTS "status" character varying(20) NOT NULL DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "associated_catalog_id" integer
    `);

    const constraint = await queryRunner.query(
      `SELECT 1 FROM pg_constraint WHERE conname = $1 AND conrelid = 'workflows'::regclass`,
      ["FK_workflows_associated_catalog_id"]
    );

    if (constraint.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "workflows"
        ADD CONSTRAINT "FK_workflows_associated_catalog_id"
        FOREIGN KEY ("associated_catalog_id") REFERENCES "catalogs"("catalog_id")
        ON DELETE SET NULL ON UPDATE NO ACTION
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workflows" DROP CONSTRAINT IF EXISTS "FK_workflows_associated_catalog_id"`);
    await queryRunner.query(`
      ALTER TABLE "workflows"
      DROP COLUMN IF EXISTS "associated_catalog_id",
      DROP COLUMN IF EXISTS "updated_at",
      DROP COLUMN IF EXISTS "version",
      DROP COLUMN IF EXISTS "status"
    `);
  }
}