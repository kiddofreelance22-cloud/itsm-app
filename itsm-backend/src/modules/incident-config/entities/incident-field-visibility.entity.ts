import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("incident_field_visibility")
export class IncidentFieldVisibility {
  @PrimaryColumn({ name: "field_name", type: "varchar", length: 100 })
  fieldName!: string;

  @Column({ type: "varchar", length: 50 })
  section!: string;

  @Column({ default: true })
  visible!: boolean;

  @Column({ default: false })
  required!: boolean;
}