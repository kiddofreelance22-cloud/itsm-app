import { MigrationInterface, QueryRunner } from "typeorm";

export class CsmProfilesAttachments1795600000000 implements MigrationInterface {
  name = "CsmProfilesAttachments1795600000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "csm_customer_contacts" (
        "contact_id" SERIAL PRIMARY KEY,
        "customer_id" integer NOT NULL REFERENCES "csm_customers"("customer_id") ON DELETE CASCADE,
        "full_name" varchar(150) NOT NULL,
        "email" varchar(254),
        "phone" varchar(40),
        "title" varchar(120),
        "is_primary" boolean NOT NULL DEFAULT false,
        "status" varchar(20) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_csm_customer_contacts_customer" ON "csm_customer_contacts" ("customer_id", "status", "full_name")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_csm_customer_contacts_primary" ON "csm_customer_contacts" ("customer_id") WHERE "is_primary" = true AND "status" = 'Active'`);
    await queryRunner.query(`
      CREATE TABLE "csm_case_attachments" (
        "attachment_id" SERIAL PRIMARY KEY,
        "case_id" integer NOT NULL REFERENCES "csm_cases"("case_id") ON DELETE CASCADE,
        "file_name" varchar(255) NOT NULL,
        "storage_name" varchar(255) NOT NULL UNIQUE,
        "mime_type" varchar(120) NOT NULL,
        "size_bytes" integer NOT NULL CHECK ("size_bytes" > 0),
        "uploaded_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "uploaded_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_csm_case_attachments_case" ON "csm_case_attachments" ("case_id", "uploaded_at" DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "csm_case_attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "csm_customer_contacts"`);
  }
}
