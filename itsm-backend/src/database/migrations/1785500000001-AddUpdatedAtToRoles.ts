import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUpdatedAtToRoles1785500000001 implements MigrationInterface {
  name = "AddUpdatedAtToRoles1785500000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "roles" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "roles" DROP COLUMN "updated_at";
    `);
  }
}
