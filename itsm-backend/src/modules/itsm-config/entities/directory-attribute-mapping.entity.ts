import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("directory_attribute_mappings")
export class DirectoryAttributeMapping {
  @PrimaryGeneratedColumn({ name: "mapping_id" }) mappingId!: number;
  @Column({ name: "source_id" }) sourceId!: number;
  @Column({ name: "local_field" }) localField!: string;
  @Column({ name: "external_attribute" }) externalAttribute!: string;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @Column({ name: "is_custom", default: false }) isCustom!: boolean;
  @Column({ name: "display_order", default: 0 }) displayOrder!: number;
}
