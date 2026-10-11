import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIncidentFieldVisibility1791200000000 implements MigrationInterface {
  name = "CreateIncidentFieldVisibility1791200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "incident_field_visibility" (
        "field_name" character varying(100) PRIMARY KEY,
        "section" character varying(50) NOT NULL,
        "visible" boolean NOT NULL DEFAULT true,
        "required" boolean NOT NULL DEFAULT false
      )
    `);
    await queryRunner.query(`
      INSERT INTO "incident_field_visibility" ("field_name", "section", "visible") VALUES
        ('Short Description', 'Incident', true),
        ('Created Date', 'Incident', true),
        ('Status', 'Incident', true),
        ('Priority', 'Incident', true),
        ('Category', 'Incident', true),
        ('Incident Number', 'Incident', true),
        ('Assigned Workgroup', 'Assignment', true),
        ('Assigned Agent', 'Assignment', true),
        ('Description', 'Incident', true),
        ('Resolution Notes', 'Resolution', true),
        ('Closure Code', 'Resolution', true),
        ('Feedback / Rating', 'Feedback', true)
      ON CONFLICT ("field_name") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "incident_field_visibility"`);
  }
}