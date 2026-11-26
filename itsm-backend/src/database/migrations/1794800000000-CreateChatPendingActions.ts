import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateChatPendingActions1794800000000 implements MigrationInterface {
  name = "CreateChatPendingActions1794800000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "chat_pending_actions" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "session_id" uuid NOT NULL,
      "user_id" integer NOT NULL,
      "kind" varchar(32) NOT NULL,
      "payload" jsonb NOT NULL,
      "expires_at" timestamp NOT NULL,
      "status" varchar(16) NOT NULL DEFAULT 'pending',
      "created_at" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_chat_pending_actions" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_chat_pending_actions_kind" CHECK ("kind" IN ('incident', 'service_request', 'ticket_update', 'handover')),
      CONSTRAINT "CHK_chat_pending_actions_status" CHECK ("status" IN ('pending', 'confirmed', 'cancelled')),
      CONSTRAINT "FK_chat_pending_actions_session" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("session_id") ON DELETE CASCADE
    )`);
    await q.query(`CREATE INDEX "IDX_chat_pending_actions_session" ON "chat_pending_actions" ("session_id")`);
    await q.query(`CREATE INDEX "IDX_chat_pending_actions_user" ON "chat_pending_actions" ("user_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "chat_pending_actions"`);
  }
}
