import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { Catalog } from "./catalog.entity";
import { User } from "../../users/entities/user.entity";

@Entity("catalog_attachments")
export class CatalogAttachment {
  @PrimaryGeneratedColumn({ name: "attachment_id" })
  attachmentId!: number;

  @ManyToOne(() => Catalog, (catalog) => catalog.attachments, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "catalog_id" })
  catalog!: Catalog;

  @Column({ name: "file_name" })
  fileName!: string;

  @Column({ name: "content_type", nullable: true })
  contentType!: string;

  @Column({ default: 0 })
  size!: number;

  // Relative URL under /uploads (see UploadService) — never a filesystem path.
  @Column({ name: "storage_path" })
  storagePath!: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by_id" })
  createdBy?: User;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
