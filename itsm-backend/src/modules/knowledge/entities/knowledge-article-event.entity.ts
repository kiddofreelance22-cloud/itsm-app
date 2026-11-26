import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

export type KnowledgeEventType = "reference" | "deflection" | "helpful" | "unhelpful";

@Entity("knowledge_article_events")
export class KnowledgeArticleEvent {
  @PrimaryGeneratedColumn({ name: "event_id" }) eventId!: number;
  @Column({ name: "article_id", type: "int" }) articleId!: number;
  @Column({ name: "event_type", type: "varchar", length: 20 }) eventType!: KnowledgeEventType;
  @Column({ name: "incident_id", type: "varchar", nullable: true }) incidentId!: string | null;
  @Column({ name: "user_id", type: "int", nullable: true }) userId!: number | null;
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
}
