import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLocation1700000000020 implements MigrationInterface {
  name = "CreateLocation1700000000020";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "locations" (
        "location_id"   SERIAL PRIMARY KEY,
        "location_name" VARCHAR(150) NOT NULL,
        "location_code" VARCHAR(50)  NOT NULL UNIQUE,
        "type"          VARCHAR(50)  NOT NULL DEFAULT 'Office',
        "description"   TEXT,
        "is_active"     BOOLEAN      NOT NULL DEFAULT true,
        "created_at"    TIMESTAMP    NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "locations";`);
  }
}
