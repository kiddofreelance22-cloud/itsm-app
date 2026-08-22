import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTasks1700000000023 implements MigrationInterface {
  name = "CreateTasks1700000000023";
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "task_id"           SERIAL PRIMARY KEY,
        "task_code"         VARCHAR(20) UNIQUE,
        "short_description" VARCHAR(255) NOT NULL,
        "description"       TEXT,
        "task_type"         VARCHAR(50) NOT NULL DEFAULT 'Investigation',
        "status"            VARCHAR(30) NOT NULL DEFAULT 'Open',
        "assigned_to"       INTEGER REFERENCES "users"("user_id") ON DELETE SET NULL,
        "incident_id"       VARCHAR REFERENCES "incidents"("incident_id") ON DELETE CASCADE,
        "due_date"          TIMESTAMP,
        "created_at"        TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tasks";`);
  }
}
