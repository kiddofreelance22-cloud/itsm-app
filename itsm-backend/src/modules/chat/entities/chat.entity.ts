import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

/** One conversation. Kept for audit: who talked to the bot, and when. */
@Entity("chat_sessions")
export class ChatSession {
  @PrimaryGeneratedColumn("uuid", { name: "session_id" }) sessionId!: string;
  @Index() @Column({ name: "user_id", type: "int" }) userId!: number;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}

/** Every message and every tool the bot used. Text is stored after personal-data masking. */
@Entity("chat_messages")
export class ChatMessage {
  @PrimaryGeneratedColumn("uuid", { name: "message_id" }) messageId!: string;
  @Index() @ManyToOne(() => ChatSession, { onDelete: "CASCADE" }) @JoinColumn({ name: "session_id" }) session!: ChatSession;
  @Column({ type: "varchar", length: 12 }) role!: "user" | "assistant";
  @Column({ type: "text" }) content!: string;
  /** Names + inputs of the tools the bot called while producing this reply (audit trail). */
  @Column({ name: "tool_calls", type: "jsonb", nullable: true })
  toolCalls?: Array<{ name: string; input: unknown; resultSummary?: unknown }> | null;
  /** 1 = thumbs up, -1 = thumbs down. */
  @Column({ type: "smallint", nullable: true }) feedback?: number | null;
  @Column({ name: "feedback_comment", type: "text", nullable: true }) feedbackComment?: string | null;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
