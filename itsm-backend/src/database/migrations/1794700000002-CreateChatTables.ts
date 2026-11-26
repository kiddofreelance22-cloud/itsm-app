import { MigrationInterface, QueryRunner } from "typeorm";

/** AI assistant: conversation + message audit log (with thumbs up/down feedback). */
export class CreateChatTables1794700000002 implements MigrationInterface {
  name = "CreateChatTables1794700000002";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await q.query(`CREATE TABLE IF NOT EXISTS "chat_sessions" (
      "session_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "user_id" integer NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_chat_sessions" PRIMARY KEY ("session_id"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_chat_sessions_user" ON "chat_sessions" ("user_id")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "chat_messages" (
      "message_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "session_id" uuid NOT NULL,
      "role" varchar(12) NOT NULL,
      "content" text NOT NULL,
      "tool_calls" jsonb,
      "feedback" smallint,
      "feedback_comment" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_chat_messages" PRIMARY KEY ("message_id"),
      CONSTRAINT "FK_chat_messages_session" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("session_id") ON DELETE CASCADE)`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_chat_messages_session" ON "chat_messages" ("session_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "chat_messages"`);
    await q.query(`DROP TABLE IF EXISTS "chat_sessions"`);
  }
}
