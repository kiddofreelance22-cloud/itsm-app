import { MigrationInterface, QueryRunner } from "typeorm";

/** Log Incident Page field configuration (which New Incident fields End Users see / must fill) and incident attachments. */
export class LogIncidentFieldsAndAttachments1792200000000 implements MigrationInterface {
  name = "LogIncidentFieldsAndAttachments1792200000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "log_incident_fields" (
        "field_key" character varying(40) PRIMARY KEY,
        "name" character varying(100) NOT NULL,
        "section" character varying(60) NOT NULL,
        "visible" boolean NOT NULL DEFAULT true,
        "required" boolean NOT NULL DEFAULT false,
        "display_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "ck_log_incident_required_needs_visible" CHECK ("required" = false OR "visible" = true)
      )`);
    // Recommended defaults, exactly as on the Design board.
    await q.query(`
      INSERT INTO "log_incident_fields" ("field_key","name","section","visible","required","display_order") VALUES
        ('category','Category','Classification',true,true,1),
        ('classification','Classification','Classification',true,true,2),
        ('shortDescription','Short Description','Details',true,true,3),
        ('description','Description','Details',true,true,4),
        ('priority','Priority','Prioritization',true,true,5),
        ('impact','Impact','Prioritization',true,true,6),
        ('urgency','Urgency','Prioritization',true,true,7),
        ('assignmentGroup','Assignment Group','Routing',true,false,8),
        ('assignedTo','Assigned To','Routing',false,false,9),
        ('configurationItem','Configuration Item','Details',true,false,10),
        ('contactType','Contact Type','Details',true,true,11),
        ('location','Location','Details',false,false,12),
        ('attachments','Attachments','Details',true,false,13)
      ON CONFLICT ("field_key") DO NOTHING`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "incident_attachments" (
        "attachment_id" SERIAL PRIMARY KEY,
        "incident_id" character varying NOT NULL REFERENCES "incidents"("incident_id") ON DELETE CASCADE,
        "file_name" character varying(255) NOT NULL,
        "mime_type" character varying(120) NOT NULL,
        "size_bytes" integer NOT NULL,
        "storage_path" character varying(400) NOT NULL,
        "uploaded_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "uploaded_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "ck_incident_attachments_size" CHECK ("size_bytes" > 0 AND "size_bytes" <= 10485760)
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_incident_attachments_incident" ON "incident_attachments" ("incident_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "incident_attachments"`);
    await q.query(`DROP TABLE IF EXISTS "log_incident_fields"`);
  }
}
