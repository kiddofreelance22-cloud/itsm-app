import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("status_versions")
export class StatusVersion {
  @PrimaryGeneratedColumn({ name: "version_id" }) versionId!: number;
  @Column({ name: "status_id" }) statusId!: number;
  @Column() version!: number;
  @Column() label!: string;
  @Column({ name: "status_name" }) statusName!: string;
  @Column({ name: "modified_by", default: "System" }) modifiedBy!: string;
  @Column({ name: "modified_at", type: "timestamp", default: () => "now()" }) modifiedAt!: Date;
}
