import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1785416138189 implements MigrationInterface {
    name = 'InitSchema1785416138189'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const createTableIfNotExists = async (tableName: string, definition: string) => {
            await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${tableName}" ${definition}`);
        };

        await createTableIfNotExists("roles", `("role_id" SERIAL NOT NULL, "role_name" character varying NOT NULL, "description" character varying, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ac35f51a0f17e3e1fe121126039" UNIQUE ("role_name"), CONSTRAINT "PK_09f4c8130b54f35925588a37b6a" PRIMARY KEY ("role_id"))`);
        await createTableIfNotExists("user_roles", `("user_role_id" SERIAL NOT NULL, "assigned_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" integer, "role_id" integer, CONSTRAINT "UQ_23ed6f04fe43066df08379fd034" UNIQUE ("user_id", "role_id"), CONSTRAINT "PK_bf176da8ac1b528d4fe7ee438e3" PRIMARY KEY ("user_role_id"))`);
        await createTableIfNotExists("users", `("user_id" SERIAL NOT NULL, "username" character varying NOT NULL, "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "full_name" character varying NOT NULL, "phone" character varying, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_96aac72f1574b88752e9fb00089" PRIMARY KEY ("user_id"))`);
        await createTableIfNotExists("workflows", `("workflow_id" SERIAL NOT NULL, "workflow_name" character varying NOT NULL, "description" character varying, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a8c8e30c11e0b49e737db92351f" PRIMARY KEY ("workflow_id"))`);
        await createTableIfNotExists("workflow_steps", `("workflow_step_id" SERIAL NOT NULL, "step_name" character varying NOT NULL, "step_order" integer NOT NULL, "step_type" character varying NOT NULL, "workflow_id" integer, "approver_role_id" integer, CONSTRAINT "PK_3719a378773effadf89f84b03b9" PRIMARY KEY ("workflow_step_id"))`);
        await createTableIfNotExists("categories", `("category_id" SERIAL NOT NULL, "category_name" character varying NOT NULL, "description" character varying, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "parent_category_id" integer, CONSTRAINT "PK_51615bef2cea22812d0dcab6e18" PRIMARY KEY ("category_id"))`);
        await createTableIfNotExists("catalog_variable_options", `("option_id" SERIAL NOT NULL, "option_label" character varying NOT NULL, "option_value" character varying NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', "variable_id" integer, CONSTRAINT "PK_7695c2ca98a936cfc2e42f7ada8" PRIMARY KEY ("option_id"))`);
        await createTableIfNotExists("catalog_variables", `("variable_id" SERIAL NOT NULL, "label" character varying NOT NULL, "field_type" character varying NOT NULL, "is_mandatory" boolean NOT NULL DEFAULT false, "default_value" character varying, "sort_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "catalog_id" integer, CONSTRAINT "PK_20d381f05ad8054cf9cfe1d907e" PRIMARY KEY ("variable_id"))`);
        await createTableIfNotExists("catalogs", `("catalog_id" SERIAL NOT NULL, "catalog_name" character varying NOT NULL, "short_description" character varying, "description" character varying, "icon_url" character varying, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "category_id" integer, "workflow_id" integer, CONSTRAINT "PK_ac5e241ce7d55e50b80d200d800" PRIMARY KEY ("catalog_id"))`);
        await createTableIfNotExists("requests", `("request_id" SERIAL NOT NULL, "status" character varying NOT NULL DEFAULT 'Submitted', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "closed_at" TIMESTAMP, "catalog_id" integer, "requested_by" integer, "current_step_id" integer, CONSTRAINT "PK_4e7b87d34546d9f21a648aed04d" PRIMARY KEY ("request_id"))`);
        await createTableIfNotExists("request_variable_values", `("value_id" SERIAL NOT NULL, "value" text, "request_id" integer, "variable_id" integer, CONSTRAINT "PK_766845aa5db7c319eba9ff47adf" PRIMARY KEY ("value_id"))`);
        await createTableIfNotExists("request_history", `("history_id" SERIAL NOT NULL, "action" character varying NOT NULL, "comments" text, "action_at" TIMESTAMP NOT NULL DEFAULT now(), "request_id" integer, "workflow_step_id" integer, "action_by" integer, CONSTRAINT "PK_146abdf101e371007426fad7ed2" PRIMARY KEY ("history_id"))`);
        await createTableIfNotExists("incidents", `("incident_id" SERIAL NOT NULL, "title" character varying NOT NULL, "description" text, "priority" character varying NOT NULL DEFAULT 'Medium', "status" character varying NOT NULL DEFAULT 'Open', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "resolved_at" TIMESTAMP, "request_id" integer, "category_id" integer, "assigned_to" integer, "created_by" integer, CONSTRAINT "PK_ff3b5892a4fc0c8fcc55ae936c2" PRIMARY KEY ("incident_id"))`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_b23c65e50a758245a33ee35fda1" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workflow_steps" ADD CONSTRAINT "FK_02f0092e12343bfed27bb65fa89" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("workflow_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workflow_steps" ADD CONSTRAINT "FK_1235d63efe19be5f7425ca3426a" FOREIGN KEY ("approver_role_id") REFERENCES "roles"("role_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_de08738901be6b34d2824a1e243" FOREIGN KEY ("parent_category_id") REFERENCES "categories"("category_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "catalog_variable_options" ADD CONSTRAINT "FK_d0091373532a02201e1be8f85c2" FOREIGN KEY ("variable_id") REFERENCES "catalog_variables"("variable_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "catalog_variables" ADD CONSTRAINT "FK_7998c8a710d2c9ad03a43ba5efe" FOREIGN KEY ("catalog_id") REFERENCES "catalogs"("catalog_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "catalogs" ADD CONSTRAINT "FK_e968b0700dc011eeb5cbc6d678b" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "catalogs" ADD CONSTRAINT "FK_536cab4e9128c506947ecb8b50e" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("workflow_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "requests" ADD CONSTRAINT "FK_fff2f5047a417f6eac7ed890d58" FOREIGN KEY ("catalog_id") REFERENCES "catalogs"("catalog_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "requests" ADD CONSTRAINT "FK_e202e8d0ac2f9c669c9052008b4" FOREIGN KEY ("requested_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "requests" ADD CONSTRAINT "FK_7938ff7092cbbd9050e858b7bdd" FOREIGN KEY ("current_step_id") REFERENCES "workflow_steps"("workflow_step_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "request_variable_values" ADD CONSTRAINT "FK_1fbf6e7205df20644bd0ff694c5" FOREIGN KEY ("request_id") REFERENCES "requests"("request_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "request_variable_values" ADD CONSTRAINT "FK_c059206f90f06f4236783ca7e7e" FOREIGN KEY ("variable_id") REFERENCES "catalog_variables"("variable_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "request_history" ADD CONSTRAINT "FK_6ebdc8efebc3beaf49aa75ba6ac" FOREIGN KEY ("request_id") REFERENCES "requests"("request_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "request_history" ADD CONSTRAINT "FK_901b94e27096372ea4117ddfc46" FOREIGN KEY ("workflow_step_id") REFERENCES "workflow_steps"("workflow_step_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "request_history" ADD CONSTRAINT "FK_0bc01ffe516ff6d2883cb28fe9d" FOREIGN KEY ("action_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "incidents" ADD CONSTRAINT "FK_6eeb6678fd5cdd7db2c6a53852a" FOREIGN KEY ("request_id") REFERENCES "requests"("request_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "incidents" ADD CONSTRAINT "FK_a97ec2e83cd4ac94439e6d9ca57" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "incidents" ADD CONSTRAINT "FK_121cb07d610a12895ea39d8a8bc" FOREIGN KEY ("assigned_to") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "incidents" ADD CONSTRAINT "FK_23aa8f140b1cb8ac605d8a448d9" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "incidents" DROP CONSTRAINT "FK_23aa8f140b1cb8ac605d8a448d9"`);
        await queryRunner.query(`ALTER TABLE "incidents" DROP CONSTRAINT "FK_121cb07d610a12895ea39d8a8bc"`);
        await queryRunner.query(`ALTER TABLE "incidents" DROP CONSTRAINT "FK_a97ec2e83cd4ac94439e6d9ca57"`);
        await queryRunner.query(`ALTER TABLE "incidents" DROP CONSTRAINT "FK_6eeb6678fd5cdd7db2c6a53852a"`);
        await queryRunner.query(`ALTER TABLE "request_history" DROP CONSTRAINT "FK_0bc01ffe516ff6d2883cb28fe9d"`);
        await queryRunner.query(`ALTER TABLE "request_history" DROP CONSTRAINT "FK_901b94e27096372ea4117ddfc46"`);
        await queryRunner.query(`ALTER TABLE "request_history" DROP CONSTRAINT "FK_6ebdc8efebc3beaf49aa75ba6ac"`);
        await queryRunner.query(`ALTER TABLE "request_variable_values" DROP CONSTRAINT "FK_c059206f90f06f4236783ca7e7e"`);
        await queryRunner.query(`ALTER TABLE "request_variable_values" DROP CONSTRAINT "FK_1fbf6e7205df20644bd0ff694c5"`);
        await queryRunner.query(`ALTER TABLE "requests" DROP CONSTRAINT "FK_7938ff7092cbbd9050e858b7bdd"`);
        await queryRunner.query(`ALTER TABLE "requests" DROP CONSTRAINT "FK_e202e8d0ac2f9c669c9052008b4"`);
        await queryRunner.query(`ALTER TABLE "requests" DROP CONSTRAINT "FK_fff2f5047a417f6eac7ed890d58"`);
        await queryRunner.query(`ALTER TABLE "catalogs" DROP CONSTRAINT "FK_536cab4e9128c506947ecb8b50e"`);
        await queryRunner.query(`ALTER TABLE "catalogs" DROP CONSTRAINT "FK_e968b0700dc011eeb5cbc6d678b"`);
        await queryRunner.query(`ALTER TABLE "catalog_variables" DROP CONSTRAINT "FK_7998c8a710d2c9ad03a43ba5efe"`);
        await queryRunner.query(`ALTER TABLE "catalog_variable_options" DROP CONSTRAINT "FK_d0091373532a02201e1be8f85c2"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_de08738901be6b34d2824a1e243"`);
        await queryRunner.query(`ALTER TABLE "workflow_steps" DROP CONSTRAINT "FK_1235d63efe19be5f7425ca3426a"`);
        await queryRunner.query(`ALTER TABLE "workflow_steps" DROP CONSTRAINT "FK_02f0092e12343bfed27bb65fa89"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_b23c65e50a758245a33ee35fda1"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"`);
        await queryRunner.query(`DROP TABLE "incidents"`);
        await queryRunner.query(`DROP TABLE "request_history"`);
        await queryRunner.query(`DROP TABLE "request_variable_values"`);
        await queryRunner.query(`DROP TABLE "requests"`);
        await queryRunner.query(`DROP TABLE "catalogs"`);
        await queryRunner.query(`DROP TABLE "catalog_variables"`);
        await queryRunner.query(`DROP TABLE "catalog_variable_options"`);
        await queryRunner.query(`DROP TABLE "categories"`);
        await queryRunner.query(`DROP TABLE "workflow_steps"`);
        await queryRunner.query(`DROP TABLE "workflows"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "user_roles"`);
        await queryRunner.query(`DROP TABLE "roles"`);
    }

}
