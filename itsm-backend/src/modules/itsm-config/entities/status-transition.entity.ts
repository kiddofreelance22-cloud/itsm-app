import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("status_transitions")
export class StatusTransition {
  @PrimaryColumn({ name: "from_status", type: "varchar", length: 60 }) fromStatus!: string;
  @PrimaryColumn({ name: "to_status", type: "varchar", length: 60 }) toStatus!: string;
  @Column({ default: false }) allowed!: boolean;
}
