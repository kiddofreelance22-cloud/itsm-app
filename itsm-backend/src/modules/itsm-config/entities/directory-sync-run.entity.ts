import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("directory_sync_runs")
export class DirectorySyncRun {
  @PrimaryGeneratedColumn({ name: "run_id" }) runId!: number;
  @Column({ name: "source_id" }) sourceId!: number;
  @Column({ name: "started_at", type: "timestamp", default: () => "now()" }) startedAt!: Date;
  @Column({ name: "finished_at", type: "timestamp", nullable: true }) finishedAt!: Date | null;
  @Column({ default: "Running" }) status!: "Running" | "Success" | "Partial" | "Failed";
  @Column({ default: 0 }) fetched!: number;
  @Column({ default: 0 }) created!: number;
  @Column({ default: 0 }) updated!: number;
  @Column({ default: 0 }) failed!: number;
  @Column({ name: "triggered_by", default: "schedule" }) triggeredBy!: string;
  @Column({ type: "text", nullable: true }) message!: string | null;
}
