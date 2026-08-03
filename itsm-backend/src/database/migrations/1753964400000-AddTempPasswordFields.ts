import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTempPasswordFields1753964400000 implements MigrationInterface {
  name = "AddTempPasswordFields1753964400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add is_temp_password column (default false so existing users are not forced to reset)
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_temp_password" boolean NOT NULL DEFAULT false`
    );
    // Add temp_password_created_at column (nullable timestamp)
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "temp_password_created_at" TIMESTAMP DEFAULT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "temp_password_created_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_temp_password"`);
  }
}
