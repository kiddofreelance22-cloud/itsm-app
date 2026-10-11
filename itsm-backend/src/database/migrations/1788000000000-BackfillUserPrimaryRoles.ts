import { MigrationInterface, QueryRunner } from "typeorm";

export class BackfillUserPrimaryRoles1788000000000 implements MigrationInterface {
  name = "BackfillUserPrimaryRoles1788000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH first_role AS (
        SELECT DISTINCT ON ("user_id")
          "user_id",
          "role_id"
        FROM "user_roles"
        ORDER BY "user_id", "assigned_at" ASC, "user_role_id" ASC
      )
      UPDATE "users" AS u
      SET "role_id" = fr."role_id"
      FROM "first_role" AS fr
      WHERE u."role_id" IS NULL
        AND fr."user_id" = u."user_id";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Intentionally left as no-op because this is a data repair migration.
    await queryRunner.query(`SELECT 1;`);
  }
}
