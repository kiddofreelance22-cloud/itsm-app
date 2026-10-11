import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Creates form templates table for reusable form designs:
 * - form_templates: Stores both group templates and form templates
 * - template_type: Distinguishes between 'group' and 'form' templates
 * - template_data: JSONB field storing the template structure
 */
export class FormTemplates1791000000002 implements MigrationInterface {
  name = "FormTemplates1791000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Form templates table ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "form_templates" (
        "form_template_id" SERIAL NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "template_type" VARCHAR(20) NOT NULL,
        "template_data" JSONB NOT NULL,
        "created_by_id" INTEGER REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_form_templates" PRIMARY KEY ("form_template_id")
      );
    `);

    // ── Add indexes ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_form_templates_type" ON "form_templates"("template_type");
      CREATE INDEX IF NOT EXISTS "IDX_form_templates_created_by" ON "form_templates"("created_by_id");
    `);

    // ── Add updated_at trigger ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_form_template_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER form_template_updated_at_trigger
        BEFORE UPDATE ON "form_templates"
        FOR EACH ROW
        EXECUTE FUNCTION update_form_template_updated_at();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Drop trigger and function ──────────────────────────────────────────────
    await queryRunner.query(`DROP TRIGGER IF EXISTS "form_template_updated_at_trigger" ON "form_templates"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_form_template_updated_at`);

    // ── Drop indexes ───────────────────────────────────────────────────────────
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_form_templates_created_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_form_templates_type"`);

    // ── Drop table ────────────────────────────────────────────────────────────
    await queryRunner.query(`DROP TABLE IF EXISTS "form_templates"`);
  }
}
