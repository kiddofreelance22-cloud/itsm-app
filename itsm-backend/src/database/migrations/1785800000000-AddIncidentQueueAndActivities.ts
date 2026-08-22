import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIncidentQueueAndActivities1785800000000 implements MigrationInterface {
  name = "AddIncidentQueueAndActivities1785800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add assignment_group_id column to incidents (nullable = unassigned goes to group queue)
    await queryRunner.query(`
      ALTER TABLE "incidents"
      ADD COLUMN IF NOT EXISTS "assignment_group_id" INTEGER
      REFERENCES "assignment_groups"("group_id") ON DELETE SET NULL;
    `);

    // Create incident_activities table (replaces static comment model)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "incident_activities" (
        "activity_id"   SERIAL PRIMARY KEY,
        "incident_id"   VARCHAR NOT NULL REFERENCES "incidents"("incident_id") ON DELETE CASCADE,
        "author_id"     INTEGER REFERENCES "users"("user_id") ON DELETE SET NULL,
        "type"          VARCHAR(50) NOT NULL DEFAULT 'comment',
        "content"       TEXT,
        "meta"          JSONB,
        "is_work_note"  BOOLEAN NOT NULL DEFAULT false,
        "created_at"    TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_incident_activities_incident_id"
      ON "incident_activities"("incident_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_incident_activities_incident_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "incident_activities";`);
    await queryRunner.query(`ALTER TABLE "incidents" DROP COLUMN IF EXISTS "assignment_group_id";`);
  }
}
