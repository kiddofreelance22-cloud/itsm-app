import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateStatus1700000000014 implements MigrationInterface {
  name = "CreateStatus1700000000014";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "statuses" (
        "status_id"   SERIAL PRIMARY KEY,
        "status_name" VARCHAR(100) NOT NULL,
        "status_code" VARCHAR(50)  NOT NULL UNIQUE,
        "type"        VARCHAR(50)  NOT NULL DEFAULT 'incident',
        "is_open"     BOOLEAN      NOT NULL DEFAULT true,
        "is_active"   BOOLEAN      NOT NULL DEFAULT true,
        "created_at"  TIMESTAMP    NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "statuses";`);
  }
}
