import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Service requests get their own masters instead of borrowing the incident ones:
 *  - service_priorities       (was: incident `priorities`)
 *  - request_pending_reasons  (was: incident `pending_reasons`)
 *
 * Both are seeded from the incident tables WITH THE SAME IDs, so every existing request, catalog item and
 * priority-matrix row keeps pointing at an identical value. From here on the two lists are edited separately.
 */
export class ServicePrioritiesAndRequestPendingReasons1793900000000 implements MigrationInterface {
  name = "ServicePrioritiesAndRequestPendingReasons1793900000000";

  /** Drops the foreign key(s) that `table.column` has to `referenced`, whatever they are called. */
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
    // ── Service priorities ─────────────────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "service_priorities" (
        "priority_id" SERIAL PRIMARY KEY,
        "priority_name" varchar NOT NULL,
        "priority_code" varchar NOT NULL UNIQUE,
        "description" text,
        "display_order" integer NOT NULL DEFAULT 0,
        "response_sla_minutes" integer,
        "resolution_sla_minutes" integer,
        "color" varchar(20),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )`);
    await q.query(`
      INSERT INTO "service_priorities" ("priority_id","priority_name","priority_code","description","display_order","response_sla_minutes","resolution_sla_minutes","color","is_active","created_at")
      SELECT "priority_id","priority_name","priority_code","description","order","response_sla_minutes","resolution_sla_minutes","color","is_active","created_at"
      FROM "priorities"
      WHERE NOT EXISTS (SELECT 1 FROM "service_priorities")`);
    await q.query(`SELECT setval(pg_get_serial_sequence('service_priorities','priority_id'), COALESCE((SELECT MAX("priority_id") FROM "service_priorities"), 0) + 1, false)`);

    await q.query(this.dropFk("requests", "priority_id", "priorities"));
    await q.query(this.dropFk("catalogs", "priority_id", "priorities"));
    await q.query(this.dropFk("request_priority_matrices", "priority_id", "priorities"));
    await q.query(`ALTER TABLE "requests" ADD CONSTRAINT "fk_requests_service_priority" FOREIGN KEY ("priority_id") REFERENCES "service_priorities"("priority_id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "catalogs" ADD CONSTRAINT "fk_catalogs_service_priority" FOREIGN KEY ("priority_id") REFERENCES "service_priorities"("priority_id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "request_priority_matrices" ADD CONSTRAINT "fk_request_matrix_service_priority" FOREIGN KEY ("priority_id") REFERENCES "service_priorities"("priority_id") ON DELETE RESTRICT`);

    // ── Request pending (hold) reasons ─────────────────────────────────
    await q.query(`
      CREATE TABLE IF NOT EXISTS "request_pending_reasons" (
        "pending_reason_id" SERIAL PRIMARY KEY,
        "pending_reason_name" varchar(100) NOT NULL UNIQUE,
        "description" text,
        "display_order" integer NOT NULL DEFAULT 0,
        "sla_impact" varchar(10) NOT NULL DEFAULT 'pause',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "ck_request_pending_reasons_sla_impact" CHECK ("sla_impact" IN ('pause','continue'))
      )`);
    await q.query(`
      INSERT INTO "request_pending_reasons" ("pending_reason_id","pending_reason_name","description","display_order","sla_impact","is_active","created_at","updated_at")
      SELECT "pending_reason_id","pending_reason_name","description","display_order","sla_impact","is_active","created_at","updated_at"
      FROM "pending_reasons"
      WHERE NOT EXISTS (SELECT 1 FROM "request_pending_reasons")`);
    await q.query(`SELECT setval(pg_get_serial_sequence('request_pending_reasons','pending_reason_id'), COALESCE((SELECT MAX("pending_reason_id") FROM "request_pending_reasons"), 0) + 1, false)`);
    await q.query(this.dropFk("requests", "pending_reason_id", "pending_reasons"));
    await q.query(`ALTER TABLE "requests" ADD CONSTRAINT "fk_requests_request_pending_reason" FOREIGN KEY ("pending_reason_id") REFERENCES "request_pending_reasons"("pending_reason_id") ON DELETE SET NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "requests" DROP CONSTRAINT IF EXISTS "fk_requests_request_pending_reason"`);
    // Only rows whose id exists in the incident table can be pointed back at it.
    await q.query(`UPDATE "requests" SET "pending_reason_id" = NULL WHERE "pending_reason_id" IS NOT NULL AND "pending_reason_id" NOT IN (SELECT "pending_reason_id" FROM "pending_reasons")`);
    await q.query(`ALTER TABLE "requests" ADD CONSTRAINT "requests_pending_reason_id_fkey" FOREIGN KEY ("pending_reason_id") REFERENCES "pending_reasons"("pending_reason_id") ON DELETE SET NULL`);
    await q.query(`DROP TABLE IF EXISTS "request_pending_reasons"`);

    await q.query(`ALTER TABLE "request_priority_matrices" DROP CONSTRAINT IF EXISTS "fk_request_matrix_service_priority"`);
    await q.query(`ALTER TABLE "catalogs" DROP CONSTRAINT IF EXISTS "fk_catalogs_service_priority"`);
    await q.query(`ALTER TABLE "requests" DROP CONSTRAINT IF EXISTS "fk_requests_service_priority"`);
    await q.query(`UPDATE "requests" SET "priority_id" = NULL WHERE "priority_id" IS NOT NULL AND "priority_id" NOT IN (SELECT "priority_id" FROM "priorities")`);
    await q.query(`UPDATE "catalogs" SET "priority_id" = NULL WHERE "priority_id" IS NOT NULL AND "priority_id" NOT IN (SELECT "priority_id" FROM "priorities")`);
    await q.query(`DELETE FROM "request_priority_matrices" WHERE "priority_id" NOT IN (SELECT "priority_id" FROM "priorities")`);
    await q.query(`ALTER TABLE "requests" ADD CONSTRAINT "requests_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "priorities"("priority_id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "catalogs" ADD CONSTRAINT "catalogs_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "priorities"("priority_id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "request_priority_matrices" ADD CONSTRAINT "request_priority_matrices_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "priorities"("priority_id") ON DELETE RESTRICT`);
    await q.query(`DROP TABLE IF EXISTS "service_priorities"`);
  }
}
