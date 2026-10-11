import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateServiceRequestMasters1789000000000 implements MigrationInterface {
  name = "CreateServiceRequestMasters1789000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "service_categories" (
      "service_category_id" SERIAL PRIMARY KEY,
      "category_name" VARCHAR(150) NOT NULL UNIQUE,
      "parent_category_id" INTEGER,
      "description" TEXT,
      "image_url" VARCHAR(500),
      "tile_color" VARCHAR(20) NOT NULL DEFAULT '#111827',
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "service_impacts" (
      "service_impact_id" SERIAL PRIMARY KEY,
      "impact_name" VARCHAR(100) NOT NULL UNIQUE,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "is_default" BOOLEAN NOT NULL DEFAULT false,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "service_completions" (
      "service_completion_id" SERIAL PRIMARY KEY,
      "completion_name" VARCHAR(100) NOT NULL UNIQUE,
      "description" TEXT,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "is_default" BOOLEAN NOT NULL DEFAULT false,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now()
    )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "service_completions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_impacts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_categories"`);
  }
}