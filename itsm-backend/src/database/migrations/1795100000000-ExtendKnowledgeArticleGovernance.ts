import { MigrationInterface, QueryRunner } from "typeorm";

export class ExtendKnowledgeArticleGovernance1795100000000 implements MigrationInterface {
  name = "ExtendKnowledgeArticleGovernance1795100000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "knowledge_articles"
        ADD COLUMN IF NOT EXISTS "summary" text,
        ADD COLUMN IF NOT EXISTS "category" varchar(120),
        ADD COLUMN IF NOT EXISTS "subcategory" varchar(120),
        ADD COLUMN IF NOT EXISTS "service" varchar(120),
        ADD COLUMN IF NOT EXISTS "configuration_item" varchar(160),
        ADD COLUMN IF NOT EXISTS "related_article_code" varchar(20),
        ADD COLUMN IF NOT EXISTS "urgency" varchar(20) NOT NULL DEFAULT 'Medium',
        ADD COLUMN IF NOT EXISTS "owner_name" varchar(150),
        ADD COLUMN IF NOT EXISTS "version" varchar(20) NOT NULL DEFAULT 'v1.0',
        ADD COLUMN IF NOT EXISTS "review_date" date,
        ADD COLUMN IF NOT EXISTS "expiry_date" date,
        ADD COLUMN IF NOT EXISTS "reviewers" jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "enable_self_service_portal" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "enable_analyst_console" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "featured" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "pinned" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "include_search_index" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "allow_comments" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "capture_usage" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "enable_rating" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "auto_suggest_incident" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "enable_ai_summary_tags" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "enable_similar_suggestions" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "allow_version_comparison" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "knowledge_articles"
        DROP COLUMN IF EXISTS "allow_version_comparison",
        DROP COLUMN IF EXISTS "enable_similar_suggestions",
        DROP COLUMN IF EXISTS "enable_ai_summary_tags",
        DROP COLUMN IF EXISTS "auto_suggest_incident",
        DROP COLUMN IF EXISTS "enable_rating",
        DROP COLUMN IF EXISTS "capture_usage",
        DROP COLUMN IF EXISTS "allow_comments",
        DROP COLUMN IF EXISTS "include_search_index",
        DROP COLUMN IF EXISTS "pinned",
        DROP COLUMN IF EXISTS "featured",
        DROP COLUMN IF EXISTS "enable_analyst_console",
        DROP COLUMN IF EXISTS "enable_self_service_portal",
        DROP COLUMN IF EXISTS "reviewers",
        DROP COLUMN IF EXISTS "expiry_date",
        DROP COLUMN IF EXISTS "review_date",
        DROP COLUMN IF EXISTS "version",
        DROP COLUMN IF EXISTS "owner_name",
        DROP COLUMN IF EXISTS "urgency",
        DROP COLUMN IF EXISTS "related_article_code",
        DROP COLUMN IF EXISTS "configuration_item",
        DROP COLUMN IF EXISTS "service",
        DROP COLUMN IF EXISTS "subcategory",
        DROP COLUMN IF EXISTS "category",
        DROP COLUMN IF EXISTS "summary"
    `);
  }
}
