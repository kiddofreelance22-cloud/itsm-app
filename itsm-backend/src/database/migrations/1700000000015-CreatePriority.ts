import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePriority1700000000015 implements MigrationInterface {
  name = "CreatePriority1700000000015";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "priorities" (
        "priority_id"   SERIAL PRIMARY KEY,
        "priority_name" VARCHAR(100) NOT NULL,
        "priority_code" VARCHAR(50)  NOT NULL UNIQUE,
        "description"   TEXT,
        "order"         INTEGER      NOT NULL DEFAULT 0,
        "is_active"     BOOLEAN      NOT NULL DEFAULT true,
        "created_at"    TIMESTAMP    NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "priorities";`);
  }
}
