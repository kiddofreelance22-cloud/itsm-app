import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUrgency1700000000017 implements MigrationInterface {
  name = "CreateUrgency1700000000017";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "urgencies" (
        "urgency_id"   SERIAL PRIMARY KEY,
        "urgency_name" VARCHAR(100) NOT NULL,
        "urgency_code" VARCHAR(50)  NOT NULL UNIQUE,
        "description"  TEXT,
        "order"        INTEGER      NOT NULL DEFAULT 0,
        "is_active"    BOOLEAN      NOT NULL DEFAULT true,
        "created_at"   TIMESTAMP    NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "urgencies";`);
  }
}
