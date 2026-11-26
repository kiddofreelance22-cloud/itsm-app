import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserIdentities1794400000000 implements MigrationInterface {
  name = "CreateUserIdentities1794400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_identities" (
        "id" SERIAL NOT NULL,
        "user_id" INTEGER NOT NULL,
        "provider" VARCHAR(20) NOT NULL,
        "subject" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "last_login_at" TIMESTAMP,
        CONSTRAINT "PK_user_identities" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_identities_provider_subject" UNIQUE ("provider", "subject"),
        CONSTRAINT "FK_user_identities_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("user_id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "user_identities"
      ADD CONSTRAINT "CHK_user_identities_provider"
      CHECK ("provider" IN ('google', 'microsoft'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_identities"`);
  }
}