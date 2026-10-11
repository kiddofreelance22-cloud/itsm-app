import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("catalog_types")
export class CatalogType {
  @PrimaryGeneratedColumn({ name: "catalog_type_id" })
  catalogTypeId!: number;

  @Column({ name: "name", type: "varchar", length: 255, unique: true })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
