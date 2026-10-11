import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkflowApprovalGate1790400000001 implements MigrationInterface {
  name = "AddWorkflowApprovalGate1790400000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workflows"
      ADD COLUMN IF NOT EXISTS "requires_approval" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "approver_role_id" integer
    `);

    const constraintExists = async (tableName: string, constraintName: string): Promise<boolean> => {
      const result = await queryRunner.query(
        `SELECT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = $1 AND conrelid = $2::regclass
         ) AS "exists"`,
        [constraintName, tableName]
      );
      return result[0]?.exists ?? false;
    };

    if (!(await constraintExists("workflows", "FK_workflows_approver_role_id"))) {
      await queryRunner.query(`
        ALTER TABLE "workflows"
        ADD CONSTRAINT "FK_workflows_approver_role_id"
        FOREIGN KEY ("approver_role_id") REFERENCES "roles"("role_id")
        ON DELETE SET NULL ON UPDATE NO ACTION
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workflows" DROP CONSTRAINT IF EXISTS "FK_workflows_approver_role_id"`);
    await queryRunner.query(`
      ALTER TABLE "workflows"
      DROP COLUMN IF EXISTS "requires_approval",
      DROP COLUMN IF EXISTS "approver_role_id"
    `);
  }
}
