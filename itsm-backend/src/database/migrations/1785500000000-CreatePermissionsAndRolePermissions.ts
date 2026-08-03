import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePermissionsAndRolePermissions1785500000000 implements MigrationInterface {
  name = "CreatePermissionsAndRolePermissions1785500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create permissions table
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "permission_id"   SERIAL PRIMARY KEY,
        "module_name"     VARCHAR(100) NOT NULL,
        "permission_type" VARCHAR(50)  NOT NULL,
        "description"     TEXT,
        "is_active"       BOOLEAN      NOT NULL DEFAULT true,
        "created_at"      TIMESTAMP    NOT NULL DEFAULT now(),
        UNIQUE("module_name", "permission_type")
      );
    `);

    // Create role_permissions junction table
    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "role_permission_id" SERIAL PRIMARY KEY,
        "role_id"            INTEGER NOT NULL REFERENCES "roles"("role_id") ON DELETE CASCADE,
        "permission_id"      INTEGER NOT NULL REFERENCES "permissions"("permission_id") ON DELETE CASCADE,
        "created_at"         TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE("role_id", "permission_id")
      );
    `);

    // Create index for faster lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_role_permissions_role_id" ON "role_permissions"("role_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_role_permissions_permission_id" ON "role_permissions"("permission_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_role_permissions_permission_id"`);
    await queryRunner.query(`DROP INDEX "IDX_role_permissions_role_id"`);
    await queryRunner.query(`DROP TABLE "role_permissions"`);
    await queryRunner.query(`DROP TABLE "permissions"`);
  }
}
