import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

export interface CabAttendee { name: string; role: string; present: boolean }

@Entity("cab_meetings")
export class CabMeeting {
  @PrimaryGeneratedColumn() id!: number;
  @Column() title!: string;
  @Column({ name: "scheduled_at", type: "timestamp" }) scheduledAt!: Date;
  @Column({ nullable: true }) location?: string;
  @Column({ nullable: true }) chair?: string;
  @Column({ default: "Planned" }) status!: "Planned" | "In Progress" | "Ended";
  @Column({ type: "jsonb", default: () => "'[]'" }) attendance!: CabAttendee[];
  @Column({ type: "text", nullable: true }) minutes?: string;
  @Column({ name: "started_at", type: "timestamp", nullable: true }) startedAt?: Date;
  @Column({ name: "ended_at", type: "timestamp", nullable: true }) endedAt?: Date;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
