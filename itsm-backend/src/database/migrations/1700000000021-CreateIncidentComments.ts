import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIncidentComments1700000000021 implements MigrationInterface {
  name = "CreateIncidentComments1700000000021";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "incident_comments" (
        "comment_id"  SERIAL PRIMARY KEY,
        "incident_id" INTEGER NOT NULL REFERENCES "incidents"("incident_id") ON DELETE CASCADE,
        "author_id"   INTEGER NOT NULL REFERENCES "users"("user_id") ON DELETE RESTRICT,
        "content"     TEXT NOT NULL,
        "created_at"  TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "incident_comments";`);
  }
}
