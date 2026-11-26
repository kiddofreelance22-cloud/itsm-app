import { MigrationInterface, QueryRunner } from "typeorm";

/** BUG-018/019: items that admins switched Active on the catalog screen were still "draft" in the builder and hidden from end users. */
export class PublishActiveCatalogItems1794700000001 implements MigrationInterface {
  name = "PublishActiveCatalogItems1794700000001";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE "catalogs" SET "status" = 'published' WHERE "is_active" = true AND lower("status") = 'draft'`);
  }

  public async down(): Promise<void> {
    // not reversible: the previous per-item draft state is not recorded
  }
}
