import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateImpact1700000000016 implements MigrationInterface {
  name = "CreateImpact1700000000016";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "impacts" (
        "impact_id"    SERIAL PRIMARY KEY,
        "impact_name"  VARCHAR(100) NOT NULL,
        "impact_code"  VARCHAR(50)  NOT NULL UNIQUE,
        "description"  TEXT,
        "order"        INTEGER      NOT NULL DEFAULT 0,
        "is_active"    BOOLEAN      NOT NULL DEFAULT true,
        "created_at"   TIMESTAMP    NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "impacts";`);
  }
}
