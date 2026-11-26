import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { ServiceRequest } from "./request.entity";
import { User } from "../../users/entities/user.entity";

/** Internal note on a request. The requester never sees these. */
@Entity("request_work_notes")
export class RequestWorkNote {
  @PrimaryGeneratedColumn({ name: "note_id" }) noteId!: number;
  @ManyToOne(() => ServiceRequest, { onDelete: "CASCADE" }) @JoinColumn({ name: "request_id" }) request!: ServiceRequest;
  @Column({ type: "text" }) text!: string;
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" }) @JoinColumn({ name: "created_by" }) createdBy?: User | null;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
