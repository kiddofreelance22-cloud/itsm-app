import { MigrationInterface, QueryRunner } from "typeorm";

export class CustomerServiceManagement1795500000000 implements MigrationInterface {
  name = "CustomerServiceManagement1795500000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "csm_customers" (
        "customer_id" SERIAL PRIMARY KEY,
        "customer_code" varchar(20) UNIQUE,
        "customer_type" varchar(10) NOT NULL CHECK ("customer_type" IN ('B2B', 'B2C')),
        "name" varchar(200) NOT NULL,
        "email" varchar(254),
        "phone" varchar(40),
        "industry" varchar(120),
        "account_type" varchar(80),
        "region" varchar(100),
        "website" varchar(300),
        "parent_customer_id" integer REFERENCES "csm_customers"("customer_id") ON DELETE SET NULL,
        "location" varchar(200),
        "segment" varchar(100),
        "preferred_channel" varchar(50),
        "status" varchar(20) NOT NULL DEFAULT 'Active' CHECK ("status" IN ('Active', 'Inactive')),
        "created_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_csm_customers_type_name" ON "csm_customers" ("customer_type", "name")`);
    await queryRunner.query(`
      CREATE TABLE "csm_contracts" (
        "contract_id" SERIAL PRIMARY KEY,
        "contract_code" varchar(24) UNIQUE,
        "customer_id" integer NOT NULL REFERENCES "csm_customers"("customer_id") ON DELETE CASCADE,
        "contract_name" varchar(200) NOT NULL,
        "contract_type" varchar(80) NOT NULL DEFAULT 'Service Contract',
        "owner_name" varchar(150),
        "status" varchar(20) NOT NULL DEFAULT 'Draft' CHECK ("status" IN ('Draft', 'Active', 'Expired', 'Terminated')),
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "auto_renew" boolean NOT NULL DEFAULT false,
        "description" text,
        "services" jsonb NOT NULL DEFAULT '[]',
        "commercial_terms" jsonb NOT NULL DEFAULT '{}',
        "created_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_csm_contract_dates" CHECK ("end_date" >= "start_date")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_csm_contracts_customer" ON "csm_contracts" ("customer_id", "status")`);
    await queryRunner.query(`
      CREATE TABLE "csm_slas" (
        "sla_id" SERIAL PRIMARY KEY,
        "sla_code" varchar(24) UNIQUE,
        "sla_name" varchar(200) NOT NULL,
        "sla_type" varchar(80) NOT NULL DEFAULT 'Operational SLA',
        "service" varchar(160) NOT NULL,
        "contract_id" integer REFERENCES "csm_contracts"("contract_id") ON DELETE SET NULL,
        "applies_to" jsonb NOT NULL DEFAULT '["Cases"]',
        "priorities" jsonb NOT NULL DEFAULT '["High","Medium","Low"]',
        "response_minutes" integer NOT NULL CHECK ("response_minutes" > 0),
        "resolution_minutes" integer NOT NULL CHECK ("resolution_minutes" > 0),
        "availability_percent" numeric(5,2),
        "escalation_policy" jsonb NOT NULL DEFAULT '{}',
        "status" varchar(20) NOT NULL DEFAULT 'Draft' CHECK ("status" IN ('Draft', 'Active', 'Inactive')),
        "description" text,
        "created_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_csm_slas_service" ON "csm_slas" ("service", "status")`);
    await queryRunner.query(`
      CREATE TABLE "csm_cases" (
        "case_id" SERIAL PRIMARY KEY,
        "case_code" varchar(24) UNIQUE,
        "customer_id" integer NOT NULL REFERENCES "csm_customers"("customer_id"),
        "customer_contact" varchar(150),
        "contact_email" varchar(254),
        "contact_phone" varchar(40),
        "case_type" varchar(30) NOT NULL CHECK ("case_type" IN ('Issue', 'Request', 'Complaint')),
        "category" varchar(120) NOT NULL,
        "subcategory" varchar(120),
        "product_service" varchar(160),
        "short_description" varchar(300) NOT NULL,
        "description" text NOT NULL,
        "priority" varchar(20) NOT NULL DEFAULT 'Medium' CHECK ("priority" IN ('Low', 'Medium', 'High', 'Critical')),
        "impact" varchar(40) NOT NULL DEFAULT 'Single User',
        "urgency" varchar(20) NOT NULL DEFAULT 'Medium',
        "status" varchar(30) NOT NULL DEFAULT 'New' CHECK ("status" IN ('New', 'Open', 'Assigned', 'In Progress', 'Pending Customer', 'Resolved', 'Closed')),
        "source" varchar(50) NOT NULL DEFAULT 'Agent',
        "assignment_group_id" integer REFERENCES "assignment_groups"("group_id") ON DELETE SET NULL,
        "assigned_to" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "sla_id" integer REFERENCES "csm_slas"("sla_id") ON DELETE SET NULL,
        "sla_response_target" timestamp,
        "sla_resolution_target" timestamp,
        "sla_response_met" boolean,
        "issue_details" jsonb NOT NULL DEFAULT '{}',
        "resolution_code" varchar(100),
        "resolution_summary" text,
        "closure_notes" text,
        "created_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "resolved_at" timestamp,
        "closed_at" timestamp
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_csm_cases_status_created" ON "csm_cases" ("status", "created_at" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_csm_cases_customer" ON "csm_cases" ("customer_id", "created_at" DESC)`);
    await queryRunner.query(`
      CREATE TABLE "csm_case_activities" (
        "activity_id" BIGSERIAL PRIMARY KEY,
        "case_id" integer NOT NULL REFERENCES "csm_cases"("case_id") ON DELETE CASCADE,
        "activity_type" varchar(30) NOT NULL CHECK ("activity_type" IN ('Work Log', 'Internal Note', 'Customer Update', 'Status Change')),
        "content" text NOT NULL,
        "created_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_csm_case_activities_case" ON "csm_case_activities" ("case_id", "created_at" DESC)`);
    await queryRunner.query(`
      CREATE TABLE "csm_escalations" (
        "escalation_id" SERIAL PRIMARY KEY,
        "escalation_code" varchar(24) UNIQUE,
        "case_id" integer NOT NULL REFERENCES "csm_cases"("case_id") ON DELETE CASCADE,
        "escalation_type" varchar(50) NOT NULL,
        "level" varchar(50) NOT NULL,
        "priority" varchar(20) NOT NULL,
        "target_group_id" integer REFERENCES "assignment_groups"("group_id") ON DELETE SET NULL,
        "target_user_id" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "due_by" timestamp NOT NULL,
        "reason" text NOT NULL,
        "comments" text,
        "recipients" jsonb NOT NULL DEFAULT '[]',
        "send_immediate_notification" boolean NOT NULL DEFAULT true,
        "status" varchar(20) NOT NULL DEFAULT 'Open' CHECK ("status" IN ('Open', 'In Progress', 'Resolved')),
        "escalated_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "resolved_at" timestamp
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_csm_escalations_case" ON "csm_escalations" ("case_id", "status")`);
    await queryRunner.query(`
      CREATE TABLE "csm_major_cases" (
        "major_case_id" SERIAL PRIMARY KEY,
        "major_case_code" varchar(24) UNIQUE,
        "title" varchar(250) NOT NULL,
        "description" text NOT NULL,
        "product_service" varchar(160) NOT NULL,
        "major_case_type" varchar(80) NOT NULL,
        "severity" varchar(20) NOT NULL CHECK ("severity" IN ('Low', 'Medium', 'High', 'Critical')),
        "business_impact" varchar(40) NOT NULL,
        "impact_type" varchar(80) NOT NULL,
        "estimated_impact" varchar(200),
        "owner_id" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "incident_commander_id" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "resolver_group_id" integer REFERENCES "assignment_groups"("group_id") ON DELETE SET NULL,
        "coordination_group_id" integer REFERENCES "assignment_groups"("group_id") ON DELETE SET NULL,
        "status" varchar(30) NOT NULL DEFAULT 'In Coordination' CHECK ("status" IN ('In Coordination', 'In Progress', 'Monitoring', 'Resolved', 'Closed')),
        "incident_start" timestamp NOT NULL,
        "target_restoration" timestamp NOT NULL,
        "notify_customers" boolean NOT NULL DEFAULT true,
        "communication_channels" jsonb NOT NULL DEFAULT '[]',
        "related_case_ids" jsonb NOT NULL DEFAULT '[]',
        "created_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "resolved_at" timestamp
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_csm_major_cases_status" ON "csm_major_cases" ("status", "incident_start" DESC)`);
    await queryRunner.query(`
      CREATE TABLE "csm_major_case_updates" (
        "update_id" BIGSERIAL PRIMARY KEY,
        "major_case_id" integer NOT NULL REFERENCES "csm_major_cases"("major_case_id") ON DELETE CASCADE,
        "content" text NOT NULL,
        "created_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "csm_case_views" (
        "view_id" SERIAL PRIMARY KEY,
        "view_name" varchar(120) NOT NULL,
        "description" varchar(300),
        "filters" jsonb NOT NULL DEFAULT '{}',
        "is_shared" boolean NOT NULL DEFAULT false,
        "created_by" integer REFERENCES "users"("user_id") ON DELETE CASCADE,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "csm_case_views"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "csm_major_case_updates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "csm_major_cases"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "csm_escalations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "csm_case_activities"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "csm_cases"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "csm_slas"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "csm_contracts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "csm_customers"`);
  }
}
