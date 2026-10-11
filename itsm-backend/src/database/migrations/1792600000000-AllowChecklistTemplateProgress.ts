import { MigrationInterface, QueryRunner } from "typeorm";

export class AllowChecklistTemplateProgress1792600000000 implements MigrationInterface {
  name = "AllowChecklistTemplateProgress1792600000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      DO $$
      DECLARE fk_name text;
      BEGIN
        SELECT constraint_row.conname INTO fk_name
        FROM pg_constraint constraint_row
        JOIN pg_class source_table ON source_table.oid = constraint_row.conrelid
        JOIN pg_namespace source_schema ON source_schema.oid = source_table.relnamespace
        JOIN pg_class target_table ON target_table.oid = constraint_row.confrelid
        JOIN pg_namespace target_schema ON target_schema.oid = target_table.relnamespace
        JOIN pg_attribute source_column
          ON source_column.attrelid = source_table.oid
          AND source_column.attnum = ANY(constraint_row.conkey)
        WHERE constraint_row.contype = 'f'
          AND source_schema.nspname = current_schema()
          AND target_schema.nspname = current_schema()
          AND source_table.relname = 'incident_checklist_progress'
          AND source_column.attname = 'item_id'
          AND target_table.relname = 'incident_wo_checklist_items'
        LIMIT 1;

        IF fk_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'incident_checklist_progress', fk_name);
        END IF;
      END $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM "incident_checklist_progress" WHERE "item_id" < 0
        ) THEN
          RAISE EXCEPTION 'Cannot restore the checklist item foreign key while template task progress exists';
        END IF;

        ALTER TABLE "incident_checklist_progress"
          ADD CONSTRAINT "FK_incident_checklist_progress_item_id"
          FOREIGN KEY ("item_id") REFERENCES "incident_wo_checklist_items"("id") ON DELETE CASCADE;
      END $$;
    `);
  }
}
