import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProblems1785940000000 implements MigrationInterface {
  name = "CreateProblems1785940000000";
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "problems" (
        "problem_id"         SERIAL PRIMARY KEY,
        "problem_code"       VARCHAR(20) UNIQUE,
        "short_description"  VARCHAR(255) NOT NULL,
        "description"        TEXT,
        "status"             VARCHAR(30) NOT NULL DEFAULT 'Open',
        "assigned_to"        INTEGER REFERENCES "users"("user_id") ON DELETE SET NULL,
        "resolved_at"        TIMESTAMP,
        "created_at"         TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"         TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "problems";`);
  }
}
