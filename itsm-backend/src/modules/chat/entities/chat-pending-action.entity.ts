import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ChatSession } from "./chat.entity";

export type ChatPendingActionKind = "incident" | "service_request" | "ticket_update" | "handover";
export type ChatPendingActionStatus = "pending" | "confirmed" | "cancelled";

@Entity("chat_pending_actions")
export class ChatPendingAction {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @ManyToOne(() => ChatSession, { onDelete: "CASCADE" })
  @JoinColumn({ name: "session_id" })
  session!: ChatSession;

  @Index()
  @Column({ name: "user_id", type: "int" })
  userId!: number;

  @Column({ type: "varchar", length: 32 })
  kind!: ChatPendingActionKind;

  @Column({ type: "jsonb" })
  payload!: Record<string, unknown>;

  @Column({ name: "expires_at", type: "timestamp" })
  expiresAt!: Date;

  @Column({ type: "varchar", length: 16, default: "pending" })
  status!: ChatPendingActionStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
