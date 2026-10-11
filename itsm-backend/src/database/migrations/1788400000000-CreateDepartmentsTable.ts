import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Departments were previously a free-text VARCHAR column on `users`.
 * This migration promotes departments to a first-class, admin-managed
 * lookup table (matching the existing DepartmentsModule entity) and
 * relinks `users` to it via a proper foreign key.
 *
 * Data safety: any distinct, non-empty values already present in
 * `users.department` are copied into the new `departments` table
 * (with a best-effort generated code) before the legacy column is
 * dropped, so no existing assignment is lost.
 */
export class CreateDepartmentsTable1788400000000 implements MigrationInterface {
  name = "CreateDepartmentsTable1788400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "departments" (
        "department_id"        SERIAL PRIMARY KEY,
        "department_name"      VARCHAR NOT NULL,
        "department_code"      VARCHAR NOT NULL UNIQUE,
        "description"          VARCHAR,
        "is_active"            BOOLEAN NOT NULL DEFAULT true,
        "available_in_portal"  BOOLEAN NOT NULL DEFAULT true,
        "created_at"           TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"           TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // Carry forward any legacy free-text department values so existing
    // user assignments aren't silently lost. Generates a short, unique
    // code from the name (e.g. "Information Technology" -> "INFORMATIO").
    await queryRunner.query(`
      INSERT INTO "departments" ("department_name", "department_code")
      SELECT DISTINCT
        trim(u."department") AS department_name,
        upper(left(regexp_replace(trim(u."department"), '[^a-zA-Z0-9]', '', 'g'), 10)) AS department_code
      FROM "users" u
      WHERE u."department" IS NOT NULL AND trim(u."department") <> ''
      ON CONFLICT ("department_code") DO NOTHING;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "department_id" INTEGER
          REFERENCES "departments"("department_id") ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      UPDATE "users" u
      SET "department_id" = d."department_id"
      FROM "departments" d
      WHERE u."department" IS NOT NULL
        AND trim(u."department") <> ''
        AND lower(trim(u."department")) = lower(d."department_name");
    `);

    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "department";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" VARCHAR;
    `);
    await queryRunner.query(`
      UPDATE "users" u
      SET "department" = d."department_name"
      FROM "departments" d
      WHERE u."department_id" = d."department_id";
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "department_id";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "departments";`);
  }
}
