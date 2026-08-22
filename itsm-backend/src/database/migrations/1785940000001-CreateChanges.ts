import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateChanges1785940000001 implements MigrationInterface {
  name = "CreateChanges1785940000001";
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "changes" (
        "change_id"          SERIAL PRIMARY KEY,
        "change_code"        VARCHAR(20) UNIQUE,
        "short_description"  VARCHAR(255) NOT NULL,
        "description"        TEXT,
        "status"             VARCHAR(30) NOT NULL DEFAULT 'Open',
        "assigned_to"        INTEGER REFERENCES "users"("user_id") ON DELETE SET NULL,
        "completed_at"       TIMESTAMP,
        "created_at"         TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"         TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "changes";`);
  }
}
