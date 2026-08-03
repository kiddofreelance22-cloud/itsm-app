import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRolePermissions1785499375734 implements MigrationInterface {
    name = 'AddRolePermissions1785499375734'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "roles" ADD "role_code" character varying`);
        await queryRunner.query(`ALTER TABLE "roles" ADD CONSTRAINT "UQ_3feee96f9a604421f24496988db" UNIQUE ("role_code")`);
        await queryRunner.query(`ALTER TABLE "roles" ADD "permissions" jsonb NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "permissions"`);
        await queryRunner.query(`ALTER TABLE "roles" DROP CONSTRAINT "UQ_3feee96f9a604421f24496988db"`);
        await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "role_code"`);
    }

}
