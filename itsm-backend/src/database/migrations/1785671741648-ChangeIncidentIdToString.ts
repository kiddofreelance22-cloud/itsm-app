import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeIncidentIdToString1785671741648 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "incident_comments" DROP CONSTRAINT IF EXISTS "incident_comments_incident_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "incidents" ALTER COLUMN "incident_id" DROP DEFAULT`);
        await queryRunner.query(`DROP SEQUENCE IF EXISTS incidents_incident_id_seq CASCADE`);

        await queryRunner.query(`ALTER TABLE "incidents" ALTER COLUMN "incident_id" TYPE varchar USING ('INC' || lpad(incident_id::text, 3, '0'))`);
        await queryRunner.query(`ALTER TABLE "incident_comments" ALTER COLUMN "incident_id" TYPE varchar USING (incident_id::varchar)`);

        await queryRunner.query(`ALTER TABLE "incident_comments"
            ADD CONSTRAINT "incident_comments_incident_id_fkey"
            FOREIGN KEY ("incident_id") REFERENCES "incidents"("incident_id") ON DELETE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "incident_comments" DROP CONSTRAINT IF EXISTS "incident_comments_incident_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "incident_comments" ALTER COLUMN "incident_id" TYPE integer USING (regexp_replace(incident_id, '^INC', '')::integer)`);
        await queryRunner.query(`ALTER TABLE "incidents" ALTER COLUMN "incident_id" TYPE integer USING (replace(incident_id, 'INC', '')::integer)`);
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS incidents_incident_id_seq`);
        await queryRunner.query(`ALTER TABLE "incidents" ALTER COLUMN "incident_id" SET DEFAULT nextval('incidents_incident_id_seq')`);
        await queryRunner.query(`ALTER TABLE "incident_comments"
            ADD CONSTRAINT "incident_comments_incident_id_fkey"
            FOREIGN KEY ("incident_id") REFERENCES "incidents"("incident_id") ON DELETE CASCADE`);
    }

}
