import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Change } from "./change.entity";

@Entity("change_work_notes")
export class ChangeWorkNote {
  @PrimaryGeneratedColumn() id!: number;
  @ManyToOne(() => Change, (c) => c.workNotes, { onDelete: "CASCADE" })
  @JoinColumn({ name: "change_id" }) change!: Change;
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "author_id" }) author?: User;
  @Column({ type: "text" }) note!: string;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
