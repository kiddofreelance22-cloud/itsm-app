import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeIncidentIdToString1785671741648 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Change sequence ownership or drop default if any
        await queryRunner.query(`ALTER TABLE "incidents" ALTER COLUMN "incident_id" DROP DEFAULT`);
        await queryRunner.query(`DROP SEQUENCE IF EXISTS incidents_incident_id_seq CASCADE`);
        
        // Alter type and data
        await queryRunner.query(`ALTER TABLE "incidents" ALTER COLUMN "incident_id" TYPE varchar USING ('INC' || lpad(incident_id::text, 3, '0'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "incidents" ALTER COLUMN "incident_id" TYPE integer USING (replace(incident_id, 'INC', '')::integer)`);
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS incidents_incident_id_seq`);
        await queryRunner.query(`ALTER TABLE "incidents" ALTER COLUMN "incident_id" SET DEFAULT nextval('incidents_incident_id_seq')`);
    }

}
