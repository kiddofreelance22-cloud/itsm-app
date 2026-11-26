import { MigrationInterface, QueryRunner } from "typeorm";

export class KnowledgeArticleAttachments1795400000000 implements MigrationInterface {
  name = "KnowledgeArticleAttachments1795400000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "knowledge_article_attachments" (
        "attachment_id" SERIAL PRIMARY KEY,
        "article_id" integer NOT NULL REFERENCES "knowledge_articles"("article_id") ON DELETE CASCADE,
        "file_name" varchar(255) NOT NULL,
        "storage_name" varchar(255) NOT NULL UNIQUE,
        "mime_type" varchar(120) NOT NULL,
        "size_bytes" integer NOT NULL,
        "uploaded_by" integer REFERENCES "users"("user_id") ON DELETE SET NULL,
        "uploaded_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_knowledge_article_attachments_article" ON "knowledge_article_attachments" ("article_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_article_attachments_article"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_article_attachments"`);
  }
}
