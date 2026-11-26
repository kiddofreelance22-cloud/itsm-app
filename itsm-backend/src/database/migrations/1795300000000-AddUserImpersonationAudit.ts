import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserImpersonationAudit1795300000000 implements MigrationInterface {
  name = "AddUserImpersonationAudit1795300000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_impersonations" (
        "impersonation_id" SERIAL PRIMARY KEY,
        "actor_user_id" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "target_user_id" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "session_id" varchar(36) NOT NULL UNIQUE,
        "ip_address" varchar(64),
        "user_agent" varchar(500),
        "started_at" timestamp NOT NULL DEFAULT now(),
        "ended_at" timestamp
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_user_impersonations_actor_started" ON "user_impersonations" ("actor_user_id", "started_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_impersonations_target_started" ON "user_impersonations" ("target_user_id", "started_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_impersonations_target_started"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_impersonations_actor_started"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_impersonations"`);
  }
}
