import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIncidentComments1700000000021 implements MigrationInterface {
  name = "CreateIncidentComments1700000000021";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "incidents" (
        "incident_id" SERIAL PRIMARY KEY,
        "title" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "priority" VARCHAR(50) NOT NULL DEFAULT 'Medium',
        "status" VARCHAR(50) NOT NULL DEFAULT 'Open',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "resolved_at" TIMESTAMP,
        "request_id" INTEGER,
        "category_id" INTEGER,
        "assigned_to" INTEGER,
        "created_by" INTEGER
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "user_id" SERIAL PRIMARY KEY,
        "username" VARCHAR(150) NOT NULL UNIQUE,
        "email" VARCHAR(255) NOT NULL UNIQUE,
        "password_hash" VARCHAR(255) NOT NULL,
        "full_name" VARCHAR(255) NOT NULL,
        "phone" VARCHAR(255),
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "incident_comments" (
        "comment_id"  SERIAL PRIMARY KEY,
        "incident_id" VARCHAR NOT NULL REFERENCES "incidents"("incident_id") ON DELETE CASCADE,
        "author_id"   INTEGER NOT NULL REFERENCES "users"("user_id") ON DELETE RESTRICT,
        "content"     TEXT NOT NULL,
        "created_at"  TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "incident_comments";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "incidents";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
  }
}
