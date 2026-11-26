import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

export type SsoProvider = "google" | "microsoft";

@Entity("user_identities")
@Unique("UQ_user_identities_provider_subject", ["provider", "subject"])
export class UserIdentity {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "varchar", length: 20 })
  provider!: SsoProvider;

  @Column({ type: "varchar", length: 255 })
  subject!: string;

  @Column({ type: "varchar", length: 255 })
  email!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt!: Date;

  @Column({ name: "last_login_at", type: "timestamp", nullable: true })
  lastLoginAt!: Date | null;
}