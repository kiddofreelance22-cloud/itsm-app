import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Data fixes from the Meridian functional test pack:
 *  - BUG-001: map every Impact x Urgency pair in the incident Priority Matrix (standard ITIL grid) where none is mapped.
 *  - BUG-004: retire the test service-priority level "SR" so it never appears on service requests.
 *  - BUG-038: business-hour windows were stored as UTC; keep the same wall-clock hours (09:00-18:00) in Asia/Kolkata.
 * All statements are idempotent and only touch rows that are wrong.
 */
export class FixPriorityMatrixAndSlaWindows1794700000000 implements MigrationInterface {
  name = "FixPriorityMatrixAndSlaWindows1794700000000";

  public async up(q: QueryRunner): Promise<void> {
    // BUG-001 — rank sum 2 → Critical, 3-4 → High, 5-6 → Medium, 7-8 → Low (rank: Critical=1 … Low=4 by name).
    await q.query(`
      INSERT INTO "priority_matrices" ("urgency_id", "impact_id", "priority_id", "is_active", "created_at", "updated_at")
      SELECT u."urgency_id", i."impact_id", p."priority_id", true, now(), now()
      FROM "urgencies" u
      CROSS JOIN "impacts" i
      CROSS JOIN LATERAL (SELECT
        (CASE lower(u."urgency_name") WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END) AS ru,
        (CASE lower(i."impact_name")  WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END) AS ri) r
      JOIN "priorities" p ON lower(p."priority_name") = (
        CASE
          WHEN r.ru + r.ri <= 2 THEN 'critical'
          WHEN r.ru + r.ri <= 4 THEN 'high'
          WHEN r.ru + r.ri <= 6 THEN 'medium'
          ELSE 'low'
        END)
      WHERE r.ru IS NOT NULL AND r.ri IS NOT NULL AND p."is_active" = true
        AND NOT EXISTS (SELECT 1 FROM "priority_matrices" m WHERE m."urgency_id" = u."urgency_id" AND m."impact_id" = i."impact_id")
    `);

    // BUG-004
    await q.query(`UPDATE "service_priorities" SET "is_active" = false WHERE upper("priority_name") = 'SR' AND "is_active" = true`);

    // BUG-038 — only windows still on UTC whose hours are the 08:00-18:00 mis-entry of the 9-to-6 shift.
    await q.query(`
      UPDATE "sla_service_windows"
      SET "time_zone" = 'Asia/Kolkata',
          "service_window" = (
            SELECT COALESCE(jsonb_agg(
              CASE WHEN (d->>'enabled')::boolean AND d->>'from' = '08:00' AND d->>'to' = '18:00'
                   THEN jsonb_set(d, '{from}', '"09:00"') ELSE d END), '[]'::jsonb)
            FROM jsonb_array_elements("service_window") d),
          "updated_at" = now()
      WHERE "time_zone" = 'UTC' AND "is_24_7" = false
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE "service_priorities" SET "is_active" = true WHERE upper("priority_name") = 'SR'`);
  }
}
