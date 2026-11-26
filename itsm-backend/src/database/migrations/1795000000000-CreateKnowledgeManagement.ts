import { MigrationInterface, QueryRunner } from "typeorm";

/** Service Knowledge Management System (SKMS): articles, the Known Error DB, and reuse / feedback events. */
export class CreateKnowledgeManagement1795000000000 implements MigrationInterface {
  name = "CreateKnowledgeManagement1795000000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "knowledge_articles" (
        "article_id" SERIAL PRIMARY KEY,
        "article_code" varchar(20) UNIQUE,
        "article_type" varchar(30) NOT NULL DEFAULT 'Standard KB',
        "title" varchar(300) NOT NULL,
        "service_line" varchar(120),
        "tags" jsonb NOT NULL DEFAULT '[]',
        "audience" jsonb NOT NULL DEFAULT '{}',
        "severity" varchar(20) NOT NULL DEFAULT 'Low',
        "author_id" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "author_name" varchar(150),
        "resolution" text NOT NULL DEFAULT '',
        "workaround_status" varchar(20) NOT NULL DEFAULT 'Draft',
        "permanent_fix_status" varchar(20) NOT NULL DEFAULT 'Pending',
        "problem_code" varchar(40),
        "status" varchar(20) NOT NULL DEFAULT 'Published',
        "last_reviewed_at" timestamp NOT NULL DEFAULT now(),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_knowledge_articles_type_status" ON "knowledge_articles" ("article_type", "status")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_knowledge_articles_author" ON "knowledge_articles" ("author_id")`);

    // reference = used to resolve a ticket, deflection = solved a portal visit without a ticket, helpful / unhelpful = rating
    await q.query(`
      CREATE TABLE IF NOT EXISTS "knowledge_article_events" (
        "event_id" SERIAL PRIMARY KEY,
        "article_id" integer NOT NULL REFERENCES "knowledge_articles"("article_id") ON DELETE CASCADE,
        "event_type" varchar(20) NOT NULL,
        "incident_id" varchar,
        "user_id" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_knowledge_events_article" ON "knowledge_article_events" ("article_id", "event_type")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_knowledge_events_created" ON "knowledge_article_events" ("event_type", "created_at")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "knowledge_article_events"`);
    await q.query(`DROP TABLE IF EXISTS "knowledge_articles"`);
  }
}
