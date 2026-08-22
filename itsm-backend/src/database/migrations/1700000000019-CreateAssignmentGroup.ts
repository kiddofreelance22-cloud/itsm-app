import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAssignmentGroup1700000000019 implements MigrationInterface {
  name = "CreateAssignmentGroup1700000000019";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "user_id"      SERIAL PRIMARY KEY,
        "username"     VARCHAR(150) NOT NULL UNIQUE,
        "email"        VARCHAR(255) NOT NULL UNIQUE,
        "password_hash" VARCHAR(255) NOT NULL,
        "full_name"    VARCHAR(255) NOT NULL,
        "phone"        VARCHAR(255),
        "is_active"    BOOLEAN      NOT NULL DEFAULT true,
        "created_at"   TIMESTAMP    NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMP    NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "assignment_groups" (
        "group_id"    SERIAL PRIMARY KEY,
        "group_name"  VARCHAR(150) NOT NULL,
        "group_code"  VARCHAR(50)  NOT NULL UNIQUE,
        "description" TEXT,
        "manager_id"  INTEGER REFERENCES "users"("user_id") ON DELETE SET NULL,
        "is_active"   BOOLEAN      NOT NULL DEFAULT true,
        "created_at"  TIMESTAMP    NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "assignment_group_members" (
        "id"       SERIAL PRIMARY KEY,
        "group_id" INTEGER NOT NULL REFERENCES "assignment_groups"("group_id") ON DELETE CASCADE,
        "user_id"  INTEGER NOT NULL REFERENCES "users"("user_id") ON DELETE CASCADE,
        UNIQUE ("group_id", "user_id")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "assignment_group_members";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assignment_groups";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
  }
}
