import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Lets an engineer pick the SLA Service Window an incident's Response and Resolution
 * clocks follow. When it is NULL the incident keeps using its workgroup's window
 * (Configuration > Workgroup SLA Window), exactly as before.
 */
export class IncidentSlaServiceWindow1792400000000 implements MigrationInterface {
  name = "IncidentSlaServiceWindow1792400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "incidents"
        ADD COLUMN IF NOT EXISTS "sla_service_window_id" INTEGER
          REFERENCES "sla_service_windows"("sla_service_window_id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "incidents" DROP COLUMN IF EXISTS "sla_service_window_id"`);
  }
}
