import { CreateDateColumn, Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export type EmailOutboxStatus = "pending" | "sent" | "failed";

@Entity("email_outbox")
@Index("idx_email_outbox_status_next_attempt_at", ["status", "nextAttemptAt"])
export class EmailOutbox {
  @PrimaryGeneratedColumn({ name: "id" })
  id!: number;

  @Column({ type: "varchar" })
  recipient!: string;

  @Column({ type: "varchar" })
  subject!: string;

  @Column({ type: "text" })
  html!: string;

  @Column({ type: "varchar", default: "pending" })
  status!: EmailOutboxStatus;

  @Column({ type: "int", default: 0 })
  attempts!: number;

  @Column({ name: "next_attempt_at", type: "timestamptz", default: () => "now()" })
  nextAttemptAt!: Date;

  @Column({ name: "last_error", type: "text", nullable: true })
  lastError?: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
