import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Backs the remaining Design boards:
 *  - Incident masters: checklists, work-order checklist, on-hold reasons, resolution codes
 *  - Classification tree (5 levels), status transition matrix
 *  - Mandatory field rules, approval rules, incident approvals
 *  - E-mail notification rules
 *  - Feedback moderation (columns on incidents)
 *  - Work orders
 *  - SLA matrix (workgroup + priority overrides) and workgroup SLA window
 *  - Directory integration (sources, attribute mappings, sync history)
 *
 * Every statement is idempotent (IF NOT EXISTS / ON CONFLICT) so it is safe on
 * databases that already ran earlier hand-made scripts.
 */
export class ItsmConfigurationSuite1792000000000 implements MigrationInterface {
  name = "ItsmConfigurationSuite1792000000000";

  public async up(q: QueryRunner): Promise<void> {
    // ── Simple ordered masters ─────────────────────────────────────────────
    for (const t of ["incident_checklists", "incident_wo_checklist_items"]) {
      await q.query(`
        CREATE TABLE IF NOT EXISTS "${t}" (
          "id" SERIAL PRIMARY KEY,
          "name" character varying(150) NOT NULL,
          "description" text,
          "display_order" integer NOT NULL DEFAULT 0,
          "is_active" boolean NOT NULL DEFAULT true,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "uq_${t}_name" UNIQUE ("name")
        )`);
    }

    await q.query(`
      CREATE TABLE IF NOT EXISTS "on_hold_reasons" (
        "id" SERIAL PRIMARY KEY,
        "name" character varying(150) NOT NULL,
        "description" text,
        "display_order" integer NOT NULL DEFAULT 0,
        "sla_impact" character varying(10) NOT NULL DEFAULT 'pause',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_on_hold_reasons_name" UNIQUE ("name"),
        CONSTRAINT "ck_on_hold_reasons_sla_impact" CHECK ("sla_impact" IN ('pause','continue'))
      )`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "resolution_codes" (
        "id" SERIAL PRIMARY KEY,
        "name" character varying(150) NOT NULL,
        "description" text,
        "display_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_resolution_codes_name" UNIQUE ("name")
      )`);

    await q.query(`
      INSERT INTO "incident_checklists" ("name","description","display_order") VALUES
        ('Standard Resolution Checklist','General steps to verify before resolving any incident.',1),
        ('Security Incident Checklist','Containment and reporting steps for security-related incidents.',2),
        ('Hardware Dispatch Checklist','Steps to confirm before dispatching a field engineer.',3),
        ('Network Outage Checklist','Diagnostic and escalation steps for network outages.',4)
      ON CONFLICT ("name") DO NOTHING`);
    await q.query(`
      INSERT INTO "incident_wo_checklist_items" ("name","description","display_order") VALUES
        ('Confirm Affected CI','Verify the correct configuration item is linked to the incident.',1),
        ('Verify User Identity','Confirm the requester''s identity before proceeding.',2),
        ('Check Duplicate Incidents','Search for related or duplicate incidents already logged.',3),
        ('Attach Diagnostic Logs','Attach relevant logs or screenshots for the assigned team.',4),
        ('Confirm Impact & Urgency','Double-check the impact and urgency are set correctly.',5)
      ON CONFLICT ("name") DO NOTHING`);
    await q.query(`
      INSERT INTO "on_hold_reasons" ("name","description","display_order","sla_impact") VALUES
        ('Awaiting Maintenance Window','Work is deferred to an agreed maintenance window.',1,'continue'),
        ('Awaiting Resource Availability','Waiting on a specific engineer, specialist, or equipment to become available.',2,'pause'),
        ('Awaiting Vendor Dispatch','Waiting on a third-party vendor to dispatch a technician or part.',3,'pause'),
        ('Blocked by Dependent Incident','Work cannot continue until a related incident or problem is resolved.',4,'pause'),
        ('Awaiting Change Implementation','Work is blocked until a related change is implemented.',5,'continue')
      ON CONFLICT ("name") DO NOTHING`);

    // ── Classification tree (max 5 levels) ─────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "classifications" (
        "classification_id" SERIAL PRIMARY KEY,
        "name" character varying(150) NOT NULL,
        "parent_id" integer REFERENCES "classifications"("classification_id") ON DELETE CASCADE,
        "level" smallint NOT NULL DEFAULT 1,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "ck_classifications_level" CHECK ("level" BETWEEN 1 AND 5)
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_classifications_sibling_name"
      ON "classifications" (COALESCE("parent_id", 0), lower("name"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_classifications_parent" ON "classifications" ("parent_id")`);
    await q.query(`
      DO $$
      DECLARE inc int; app int; perf int; slow int; svc int; prob int; chg int; sec int; inq int;
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM "classifications") THEN
          INSERT INTO "classifications"("name","level") VALUES ('Incident',1) RETURNING classification_id INTO inc;
          INSERT INTO "classifications"("name","parent_id","level") VALUES ('Application',inc,2) RETURNING classification_id INTO app;
          INSERT INTO "classifications"("name","parent_id","level") VALUES ('Performance',app,3) RETURNING classification_id INTO perf;
          INSERT INTO "classifications"("name","parent_id","level") VALUES ('Slow Response',perf,4) RETURNING classification_id INTO slow;
          INSERT INTO "classifications"("name","parent_id","level") VALUES ('Database Query Timeout',slow,5);
          INSERT INTO "classifications"("name","parent_id","level") VALUES ('High CPU Usage',perf,4);
          INSERT INTO "classifications"("name","parent_id","level") VALUES ('Application Crash',app,3),('Login Failure',app,3);
          INSERT INTO "classifications"("name","parent_id","level") VALUES ('Infrastructure',inc,2),('Connectivity',inc,2);
          INSERT INTO "classifications"("name","level") VALUES ('Service Request',1) RETURNING classification_id INTO svc;
          INSERT INTO "classifications"("name","parent_id","level") VALUES ('Access Request',svc,2),('Hardware Request',svc,2);
          INSERT INTO "classifications"("name","parent_id","level","is_active") VALUES ('Software Installation',svc,2,false);
          INSERT INTO "classifications"("name","level") VALUES ('Problem',1) RETURNING classification_id INTO prob;
          INSERT INTO "classifications"("name","parent_id","level") VALUES ('Recurring Incident',prob,2),('Root Cause Analysis',prob,2);
          INSERT INTO "classifications"("name","level") VALUES ('Change Request',1) RETURNING classification_id INTO chg;
          INSERT INTO "classifications"("name","parent_id","level") VALUES ('Standard Change',chg,2),('Emergency Change',chg,2);
          INSERT INTO "classifications"("name","level") VALUES ('Security Event',1) RETURNING classification_id INTO sec;
          INSERT INTO "classifications"("name","parent_id","level") VALUES ('Phishing',sec,2),('Malware',sec,2);
          INSERT INTO "classifications"("name","level") VALUES ('Inquiry / Complaint',1) RETURNING classification_id INTO inq;
          INSERT INTO "classifications"("name","parent_id","level") VALUES ('General Inquiry',inq,2),('Service Complaint',inq,2);
        END IF;
      END $$;`);
    // Incident can carry a classification (used by mandatory-field / approval rule conditions).
    await q.query(`ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "classification_id" integer
      REFERENCES "classifications"("classification_id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "pending_reason" character varying(150)`);
    await q.query(`ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "on_hold_reason" character varying(150)`);
    await q.query(`ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "sla_paused_at" TIMESTAMP`);

    // ── Status transition matrix ───────────────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "status_transitions" (
        "from_status" character varying(60) NOT NULL,
        "to_status" character varying(60) NOT NULL,
        "allowed" boolean NOT NULL DEFAULT false,
        PRIMARY KEY ("from_status","to_status")
      )`);
    // Recommended flow (same defaults as the Design board's "Reset to Recommended Flow").
    const flow: Record<string, string[]> = {
      "Open": ["Assigned", "In Progress", "On Hold", "Resolved", "Closed"],
      "Assigned": ["Open", "In Progress", "On Hold", "Resolved"],
      "In Progress": ["Assigned", "On Hold", "Resolved"],
      "On Hold": ["Assigned", "In Progress", "Resolved"],
      "Resolved": ["Open", "In Progress", "Closed"],
      "Closed": ["Open"],
    };
    const all = Object.keys(flow);
    for (const from of all) {
      for (const to of all) {
        if (from === to) continue;
        await q.query(
          `INSERT INTO "status_transitions" ("from_status","to_status","allowed") VALUES ($1,$2,$3)
           ON CONFLICT ("from_status","to_status") DO NOTHING`,
          [from, to, flow[from].includes(to)],
        );
      }
    }

    // ── Rules ──────────────────────────────────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "mandatory_field_rules" (
        "rule_id" SERIAL PRIMARY KEY,
        "name" character varying(200) NOT NULL DEFAULT '',
        "condition_field" character varying(60) NOT NULL,
        "condition_values" text[] NOT NULL DEFAULT '{}',
        "target_fields" text[] NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "display_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await q.query(`
      INSERT INTO "mandatory_field_rules" ("name","condition_field","condition_values","target_fields","display_order")
      SELECT * FROM (VALUES
        ('Assignment required once In Progress','Status',ARRAY['In Progress'],ARRAY['Assignment Group'],1),
        ('Resolution notes required to resolve','Status',ARRAY['Resolved'],ARRAY['Resolution Notes'],2)
      ) AS v(a,b,c,d,e)
      WHERE NOT EXISTS (SELECT 1 FROM "mandatory_field_rules")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "approval_rules" (
        "rule_id" SERIAL PRIMARY KEY,
        "name" character varying(200) NOT NULL DEFAULT '',
        "action" character varying(20) NOT NULL,
        "approval_type" character varying(40) NOT NULL,
        "condition_field" character varying(60) NOT NULL DEFAULT 'Any Incident',
        "condition_values" text[] NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "display_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "ck_approval_rules_action" CHECK ("action" IN ('Resolve','Close','Reopen'))
      )`);
    await q.query(`
      INSERT INTO "approval_rules" ("name","action","approval_type","condition_field","condition_values","display_order")
      SELECT * FROM (VALUES
        ('Closure sign-off for high-priority incidents','Close','Closure Approval','Priority',ARRAY['High','Critical'],1),
        ('Approval required to reopen any resolved incident','Reopen','Reopen Approval','Any Incident',ARRAY[]::text[],2)
      ) AS v(a,b,c,d,e,f)
      WHERE NOT EXISTS (SELECT 1 FROM "approval_rules")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "incident_approvals" (
        "approval_id" SERIAL PRIMARY KEY,
        "incident_id" character varying NOT NULL REFERENCES "incidents"("incident_id") ON DELETE CASCADE,
        "approval_type" character varying(40) NOT NULL,
        "action" character varying(20) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'Pending',
        "requested_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "request_comments" text,
        "approver_id" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "approver_note" text,
        "requested_at" TIMESTAMP NOT NULL DEFAULT now(),
        "decided_at" TIMESTAMP,
        "consumed_at" TIMESTAMP,
        CONSTRAINT "ck_incident_approvals_status" CHECK ("status" IN ('Pending','Approved','Rejected'))
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_incident_approvals_incident" ON "incident_approvals" ("incident_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_incident_approvals_status" ON "incident_approvals" ("status")`);

    // ── E-mail notification rules ──────────────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "notification_rules" (
        "rule_id" SERIAL PRIMARY KEY,
        "name" character varying(200) NOT NULL,
        "trigger_event" character varying(40) NOT NULL,
        "recipients" text[] NOT NULL DEFAULT '{}',
        "subject" character varying(300) NOT NULL,
        "body" text NOT NULL DEFAULT '',
        "display_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_notification_rules_name" UNIQUE ("name")
      )`);
    await q.query(`
      INSERT INTO "notification_rules" ("name","trigger_event","recipients","subject","body","display_order") VALUES
        ('Incident Created – Confirmation','created',ARRAY['reporter'],
          'Your incident {{incident.id}} has been received',
          E'Hi {{incident.reporter}},\\n\\nWe''ve logged your incident "{{incident.shortDescription}}" as {{incident.id}}. We''ll keep you posted as it progresses.\\n\\nThanks,\\nMeridian Support',1),
        ('Incident Assigned – Agent Alert','assigned',ARRAY['assignedAgent','workgroup'],
          'Incident {{incident.id}} assigned to you',
          E'Hi {{incident.assignedTo}},\\n\\nIncident {{incident.id}} ("{{incident.shortDescription}}") has been assigned to you. Priority: {{incident.priority}}.\\n\\nPlease review and begin work.',2),
        ('Incident Resolved – Notify Reporter','resolved',ARRAY['reporter','watchers'],
          'Incident {{incident.id}} has been resolved',
          E'Hi {{incident.reporter}},\\n\\nYour incident {{incident.id}} has been resolved. Please review the resolution and let us know if you need it reopened.\\n\\nThanks,\\nMeridian Support',3),
        ('SLA Breach Warning','slaBreachWarning',ARRAY['assignedAgent','workgroup'],
          'SLA at risk for incident {{incident.id}}',
          E'Heads up — incident {{incident.id}} ("{{incident.shortDescription}}") is approaching its SLA deadline. Priority: {{incident.priority}}.',4)
      ON CONFLICT ("name") DO NOTHING`);

    // ── Feedback moderation (lives on the incident) ────────────────────────
    await q.query(`ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "feedback_submitted_at" TIMESTAMP`);
    await q.query(`ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "feedback_published" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "feedback_flagged" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "feedback_moderator_note" text`);
    await q.query(`ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "feedback_moderated_by" integer
      REFERENCES "users"("user_id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "feedback_moderated_at" TIMESTAMP`);
    // Existing ratings become "submitted" at the time the incident was last touched.
    await q.query(`UPDATE "incidents" SET "feedback_submitted_at" = COALESCE("closed_at","updated_at")
      WHERE "feedback_rating" IS NOT NULL AND "feedback_submitted_at" IS NULL`);

    // ── Work orders ────────────────────────────────────────────────────────
    await q.query(`CREATE SEQUENCE IF NOT EXISTS "work_order_number_seq" START 1042`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "work_orders" (
        "work_order_id" SERIAL PRIMARY KEY,
        "wo_number" character varying(20) NOT NULL UNIQUE
          DEFAULT ('WO-' || nextval('work_order_number_seq')),
        "incident_id" character varying REFERENCES "incidents"("incident_id") ON DELETE SET NULL,
        "title" character varying(250) NOT NULL,
        "notes" text,
        "group_id" integer REFERENCES "assignment_groups"("group_id") ON DELETE SET NULL,
        "assigned_to" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "priority" character varying(20) NOT NULL DEFAULT 'P3 - Medium',
        "status" character varying(20) NOT NULL DEFAULT 'Open',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "ck_work_orders_status" CHECK ("status" IN ('Open','In Progress','On Hold','Completed','Cancelled'))
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_work_orders_incident" ON "work_orders" ("incident_id")`);

    // ── SLA matrix + workgroup SLA window ──────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "sla_matrix" (
        "sla_matrix_id" SERIAL PRIMARY KEY,
        "group_id" integer NOT NULL REFERENCES "assignment_groups"("group_id") ON DELETE CASCADE,
        "priority_id" integer NOT NULL REFERENCES "priorities"("priority_id") ON DELETE CASCADE,
        "response_minutes" integer NOT NULL,
        "resolution_minutes" integer NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_sla_matrix_group_priority" UNIQUE ("group_id","priority_id"),
        CONSTRAINT "ck_sla_matrix_positive" CHECK ("response_minutes" > 0 AND "resolution_minutes" > 0),
        CONSTRAINT "ck_sla_matrix_response_le_resolution" CHECK ("response_minutes" <= "resolution_minutes")
      )`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "workgroup_sla_windows" (
        "group_id" integer PRIMARY KEY REFERENCES "assignment_groups"("group_id") ON DELETE CASCADE,
        "sla_service_window_id" integer REFERENCES "sla_service_windows"("sla_service_window_id") ON DELETE SET NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )`);

    // ── Directory integration ──────────────────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "directory_sources" (
        "source_id" SERIAL PRIMARY KEY,
        "type" character varying(10) NOT NULL,
        "name" character varying(150) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT false,
        "auto_create_users" boolean NOT NULL DEFAULT false,
        "ldap_url" character varying(300),
        "bind_dn" character varying(400),
        "bind_password" text,
        "base_dn" character varying(400),
        "search_filter" character varying(400) DEFAULT '(objectClass=user)',
        "default_role" character varying(40) DEFAULT 'End User',
        "tenant_id" character varying(150),
        "client_id" character varying(100),
        "client_secret" text,
        "redirect_uri" character varying(400),
        "sso_enabled" boolean NOT NULL DEFAULT false,
        "sso_only" boolean NOT NULL DEFAULT false,
        "allowed_domains" text,
        "last_test_ok" boolean,
        "last_test_message" text,
        "last_tested_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "ck_directory_sources_type" CHECK ("type" IN ('ldap','azure_ad'))
      )`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "directory_attribute_mappings" (
        "mapping_id" SERIAL PRIMARY KEY,
        "source_id" integer NOT NULL REFERENCES "directory_sources"("source_id") ON DELETE CASCADE,
        "local_field" character varying(100) NOT NULL,
        "external_attribute" character varying(150) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_custom" boolean NOT NULL DEFAULT false,
        "display_order" integer NOT NULL DEFAULT 0
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_dir_mappings_source" ON "directory_attribute_mappings" ("source_id")`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "directory_sync_runs" (
        "run_id" SERIAL PRIMARY KEY,
        "source_id" integer NOT NULL REFERENCES "directory_sources"("source_id") ON DELETE CASCADE,
        "started_at" TIMESTAMP NOT NULL DEFAULT now(),
        "finished_at" TIMESTAMP,
        "status" character varying(10) NOT NULL DEFAULT 'Running',
        "fetched" integer NOT NULL DEFAULT 0,
        "created" integer NOT NULL DEFAULT 0,
        "updated" integer NOT NULL DEFAULT 0,
        "failed" integer NOT NULL DEFAULT 0,
        "triggered_by" character varying(150) NOT NULL DEFAULT 'schedule',
        "message" text,
        CONSTRAINT "ck_directory_sync_status" CHECK ("status" IN ('Running','Success','Partial','Failed'))
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_dir_sync_source_started" ON "directory_sync_runs" ("source_id","started_at" DESC)`);

    // Two empty, inactive sources so the Directory Settings / Attribute Mapping
    // screens have the same two cards as the design. No credentials are seeded.
    await q.query(`
      INSERT INTO "directory_sources" ("type","name","is_active","auto_create_users","sso_enabled")
      SELECT 'ldap','Corporate Active Directory',false,true,false
      WHERE NOT EXISTS (SELECT 1 FROM "directory_sources" WHERE "type"='ldap')`);
    await q.query(`
      INSERT INTO "directory_sources" ("type","name","is_active","auto_create_users","sso_enabled")
      SELECT 'azure_ad','Azure AD / Microsoft 365',false,true,true
      WHERE NOT EXISTS (SELECT 1 FROM "directory_sources" WHERE "type"='azure_ad')`);
    await q.query(`
      INSERT INTO "directory_attribute_mappings" ("source_id","local_field","external_attribute","display_order")
      SELECT s.source_id, m.lf, m.ea, m.ord
      FROM "directory_sources" s
      CROSS JOIN (VALUES
        ('Full Name','displayName',1),('Email Address','mail',2),('Department','department',3),
        ('Job Title','title',4),('Phone Number','telephoneNumber',5),
        ('Office Location','physicalDeliveryOfficeName',6),('User Principal Name (reference)','userPrincipalName',7)
      ) AS m(lf,ea,ord)
      WHERE NOT EXISTS (SELECT 1 FROM "directory_attribute_mappings" x WHERE x.source_id = s.source_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of [
      "directory_sync_runs", "directory_attribute_mappings", "directory_sources",
      "workgroup_sla_windows", "sla_matrix", "work_orders", "incident_approvals",
      "approval_rules", "mandatory_field_rules", "notification_rules", "status_transitions",
    ]) {
      await q.query(`DROP TABLE IF EXISTS "${t}"`);
    }
    await q.query(`DROP SEQUENCE IF EXISTS "work_order_number_seq"`);
    for (const c of [
      "feedback_moderated_at", "feedback_moderated_by", "feedback_moderator_note", "feedback_flagged",
      "feedback_published", "feedback_submitted_at", "sla_paused_at", "on_hold_reason", "pending_reason",
      "classification_id",
    ]) {
      await q.query(`ALTER TABLE "incidents" DROP COLUMN IF EXISTS "${c}"`);
    }
    for (const t of [
      "classifications", "resolution_codes", "on_hold_reasons",
      "incident_wo_checklist_items", "incident_checklists",
    ]) {
      await q.query(`DROP TABLE IF EXISTS "${t}" CASCADE`);
    }
  }
}
