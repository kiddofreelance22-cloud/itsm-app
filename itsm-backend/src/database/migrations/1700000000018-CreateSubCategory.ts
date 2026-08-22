import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSubCategory1700000000018 implements MigrationInterface {
  name = "CreateSubCategory1700000000018";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "category_id"      SERIAL PRIMARY KEY,
        "category_name"    VARCHAR(150) NOT NULL,
        "description"      TEXT,
        "is_active"        BOOLEAN      NOT NULL DEFAULT true,
        "created_at"       TIMESTAMP    NOT NULL DEFAULT now(),
        "parent_category_id" INTEGER REFERENCES "categories"("category_id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sub_categories" (
        "sub_category_id"   SERIAL PRIMARY KEY,
        "sub_category_name" VARCHAR(150) NOT NULL,
        "sub_category_code" VARCHAR(50)  NOT NULL UNIQUE,
        "description"       TEXT,
        "category_id"       INTEGER REFERENCES "categories"("category_id") ON DELETE SET NULL,
        "is_active"         BOOLEAN      NOT NULL DEFAULT true,
        "created_at"        TIMESTAMP    NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sub_categories";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories";`);
  }
}
