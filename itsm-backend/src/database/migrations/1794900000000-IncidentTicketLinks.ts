import { MigrationInterface, QueryRunner } from "typeorm";

export class IncidentTicketLinks1794900000000 implements MigrationInterface {
  name = "IncidentTicketLinks1794900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "incident_ticket_links" (
        "link_id" SERIAL PRIMARY KEY,
        "incident_id" varchar NOT NULL REFERENCES "incidents"("incident_id") ON DELETE CASCADE,
        "target_type" varchar(20) NOT NULL,
        "target_ref" varchar(60) NOT NULL,
        "relation" varchar(30) NOT NULL DEFAULT 'Related to',
        "created_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "uq_incident_ticket_link_target" UNIQUE ("incident_id", "target_type", "target_ref")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_incident_ticket_links_target" ON "incident_ticket_links" ("target_type", "target_ref")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "incident_ticket_links"`);
  }
}
