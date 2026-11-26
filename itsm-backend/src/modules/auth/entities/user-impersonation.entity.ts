import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("user_impersonations")
export class UserImpersonation {
  @PrimaryGeneratedColumn({ name: "impersonation_id" })
  impersonationId!: number;

  @Column({ name: "actor_user_id", type: "integer", nullable: true })
  actorUserId!: number | null;

  @Column({ name: "target_user_id", type: "integer", nullable: true })
  targetUserId!: number | null;

  @Column({ name: "session_id", type: "varchar", length: 36, unique: true })
  sessionId!: string;

  @Column({ name: "ip_address", type: "varchar", length: 64, nullable: true })
  ipAddress!: string | null;

  @Column({ name: "user_agent", type: "varchar", length: 500, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: "started_at", type: "timestamp" })
  startedAt!: Date;

  @Column({ name: "ended_at", type: "timestamp", nullable: true })
  endedAt!: Date | null;
}
