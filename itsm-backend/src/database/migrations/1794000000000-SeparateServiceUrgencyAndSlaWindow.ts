import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Service requests get their own separate SLA configurations instead of sharing with Incidents:
 *  - service_urgencies              (was: incident `urgencies`)
 *  - request_sla_service_windows    (was: incident `sla_service_windows`)
 *
 * Both are seeded from the incident tables WITH THE SAME IDs, so every existing request,
 * catalog item and request priority matrix row keeps pointing at an identical value.
 * From here on, service requests and incidents are configured and managed completely separately.
 */
export class SeparateServiceUrgencyAndSlaWindow1794000000000 implements MigrationInterface {
  name = "SeparateServiceUrgencyAndSlaWindow1794000000000";

  /** Drops foreign key(s) that `table.column` has to `referenced`. */
  private dropFk(table: string, column: string, referenced: string) {
    return `
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
          WHERE con.contype = 'f'
            AND con.conrelid = '"${table}"'::regclass
            AND con.confrelid = '"${referenced}"'::regclass
            AND att.attname = '${column}'
        LOOP
          EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '${table}', r.conname);
        END LOOP;
      END $$;`;
  }

  public async up(q: QueryRunner): Promise<void> {
    // ── Service Urgencies ─────────────────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "service_urgencies" (
        "urgency_id" SERIAL PRIMARY KEY,
        "urgency_name" varchar NOT NULL,
        "urgency_code" varchar NOT NULL UNIQUE,
        "description" text,
        "order" integer NOT NULL DEFAULT 0,
        "color" varchar(20),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )`);

    await q.query(`
      INSERT INTO "service_urgencies" ("urgency_id", "urgency_name", "urgency_code", "description", "order", "color", "is_active", "created_at")
      SELECT "urgency_id", "urgency_name", "urgency_code", "description", "order", "color", "is_active", "created_at"
      FROM "urgencies"
      WHERE NOT EXISTS (SELECT 1 FROM "service_urgencies")`);

    await q.query(`
      SELECT setval(pg_get_serial_sequence('service_urgencies','urgency_id'), COALESCE((SELECT MAX("urgency_id") FROM "service_urgencies"), 0) + 1, false)`);

    await q.query(this.dropFk("requests", "urgency_id", "urgencies"));
    await q.query(this.dropFk("catalogs", "urgency_id", "urgencies"));
    await q.query(this.dropFk("request_priority_matrices", "urgency_id", "urgencies"));

    await q.query(`ALTER TABLE "requests" ADD CONSTRAINT "fk_requests_service_urgency" FOREIGN KEY ("urgency_id") REFERENCES "service_urgencies"("urgency_id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "catalogs" ADD CONSTRAINT "fk_catalogs_service_urgency" FOREIGN KEY ("urgency_id") REFERENCES "service_urgencies"("urgency_id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "request_priority_matrices" ADD CONSTRAINT "fk_request_matrix_service_urgency" FOREIGN KEY ("urgency_id") REFERENCES "service_urgencies"("urgency_id") ON DELETE RESTRICT`);

    // ── Request SLA Service Windows ───────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "request_sla_service_windows" (
        "sla_service_window_id" SERIAL PRIMARY KEY,
        "sla_name" varchar(150) NOT NULL UNIQUE,
        "holiday_calendar_location" varchar(255),
        "use_analyst_work_location" boolean NOT NULL DEFAULT false,
        "description" text,
        "display_order" integer NOT NULL DEFAULT 0,
        "time_zone" varchar(100) NOT NULL DEFAULT 'UTC',
        "is_default" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_24_7" boolean NOT NULL DEFAULT false,
        "service_window" jsonb NOT NULL DEFAULT '[]',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )`);

    await q.query(`
      INSERT INTO "request_sla_service_windows" ("sla_service_window_id", "sla_name", "holiday_calendar_location", "use_analyst_work_location", "description", "display_order", "time_zone", "is_default", "is_active", "is_24_7", "service_window", "created_at", "updated_at")
      SELECT "sla_service_window_id", "sla_name", "holiday_calendar_location", "use_analyst_work_location", "description", "display_order", "time_zone", "is_default", "is_active", "is_24_7", "service_window", "created_at", "updated_at"
      FROM "sla_service_windows"
      WHERE NOT EXISTS (SELECT 1 FROM "request_sla_service_windows")`);

    await q.query(`
      SELECT setval(pg_get_serial_sequence('request_sla_service_windows','sla_service_window_id'), COALESCE((SELECT MAX("sla_service_window_id") FROM "request_sla_service_windows"), 0) + 1, false)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "request_priority_matrices" DROP CONSTRAINT IF EXISTS "fk_request_matrix_service_urgency"`);
    await q.query(`ALTER TABLE "catalogs" DROP CONSTRAINT IF EXISTS "fk_catalogs_service_urgency"`);
    await q.query(`ALTER TABLE "requests" DROP CONSTRAINT IF EXISTS "fk_requests_service_urgency"`);

    await q.query(`UPDATE "requests" SET "urgency_id" = NULL WHERE "urgency_id" IS NOT NULL AND "urgency_id" NOT IN (SELECT "urgency_id" FROM "urgencies")`);
    await q.query(`UPDATE "catalogs" SET "urgency_id" = NULL WHERE "urgency_id" IS NOT NULL AND "urgency_id" NOT IN (SELECT "urgency_id" FROM "urgencies")`);
    await q.query(`DELETE FROM "request_priority_matrices" WHERE "urgency_id" NOT IN (SELECT "urgency_id" FROM "urgencies")`);

    await q.query(`ALTER TABLE "requests" ADD CONSTRAINT "requests_urgency_id_fkey" FOREIGN KEY ("urgency_id") REFERENCES "urgencies"("urgency_id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "catalogs" ADD CONSTRAINT "catalogs_urgency_id_fkey" FOREIGN KEY ("urgency_id") REFERENCES "urgencies"("urgency_id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "request_priority_matrices" ADD CONSTRAINT "request_priority_matrices_urgency_id_fkey" FOREIGN KEY ("urgency_id") REFERENCES "urgencies"("urgency_id") ON DELETE RESTRICT`);

    await q.query(`DROP TABLE IF EXISTS "service_urgencies"`);
    await q.query(`DROP TABLE IF EXISTS "request_sla_service_windows"`);
  }
}
