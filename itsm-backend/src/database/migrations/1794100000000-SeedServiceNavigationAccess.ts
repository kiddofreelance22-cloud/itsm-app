import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedServiceNavigationAccess1794100000000 implements MigrationInterface {
  name = "SeedServiceNavigationAccess1794100000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      INSERT INTO "role_navigation_access" ("role_id", "nav_key", "visible", "can_create")
      SELECT DISTINCT r.role_id, k.nav_key, true, false
      FROM "role_navigation_access" r
      CROSS JOIN (
        VALUES
          ('/config/admin/service-priority'),
          ('/config/admin/service-urgency'),
          ('/config/admin/request-sla-service-window'),
          ('/config/admin/request-pending-reason'),
          ('/config/admin/request-priority-matrix')
      ) AS k(nav_key)
      WHERE r.nav_key LIKE '/config/%'
      ON CONFLICT ("role_id", "nav_key") DO NOTHING;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // no-op
  }
}
