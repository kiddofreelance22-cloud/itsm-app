import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("knowledge_article_attachments")
export class KnowledgeArticleAttachment {
  @PrimaryGeneratedColumn({ name: "attachment_id" })
  attachmentId!: number;

  @Column({ name: "article_id", type: "integer" })
  articleId!: number;

  @Column({ name: "file_name", type: "varchar", length: 255 })
  fileName!: string;

  @Column({ name: "storage_name", type: "varchar", length: 255, unique: true })
  storageName!: string;

  @Column({ name: "mime_type", type: "varchar", length: 120 })
  mimeType!: string;

  @Column({ name: "size_bytes", type: "integer" })
  sizeBytes!: number;

  @Column({ name: "uploaded_by", type: "integer", nullable: true })
  uploadedBy!: number | null;

  @CreateDateColumn({ name: "uploaded_at", type: "timestamp" })
  uploadedAt!: Date;
}
