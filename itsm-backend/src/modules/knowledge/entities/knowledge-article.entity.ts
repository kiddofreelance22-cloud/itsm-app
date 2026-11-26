import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

export type KnowledgeArticleType = "Standard KB" | "Known Error" | "Standard Change";
export type KnowledgeSeverity = "Low" | "Medium" | "High" | "Critical"; // the UI offers the first three
export type WorkaroundStatus = "Draft" | "Pending" | "Verified";
export type KnowledgeStatus = "Draft" | "Published" | "Pending Archive" | "Archived";

export interface KnowledgeAudience {
  targetUserGroup?: string;
  analystRole?: string;
  workgroup?: string;
  location?: string;
  department?: string;
}

@Entity("knowledge_articles")
export class KnowledgeArticle {
  @PrimaryGeneratedColumn({ name: "article_id" }) articleId!: number;

  /** KB-10492 style reference, assigned right after the first insert. */
  @Column({ name: "article_code", type: "varchar", length: 20, unique: true, nullable: true }) articleCode!: string | null;

  @Column({ name: "article_type", type: "varchar", length: 30, default: "Standard KB" }) articleType!: KnowledgeArticleType;
  @Column({ type: "varchar", length: 300 }) title!: string;
  @Column({ type: "text", nullable: true }) summary!: string | null;
  @Column({ name: "service_line", type: "varchar", length: 120, nullable: true }) serviceLine!: string | null;
  @Column({ type: "varchar", length: 120, nullable: true }) category!: string | null;
  @Column({ type: "varchar", length: 120, nullable: true }) subcategory!: string | null;
  @Column({ type: "varchar", length: 120, nullable: true }) service!: string | null;
  @Column({ name: "configuration_item", type: "varchar", length: 160, nullable: true }) configurationItem!: string | null;
  @Column({ name: "related_article_code", type: "varchar", length: 20, nullable: true }) relatedArticleCode!: string | null;
  @Column({ type: "jsonb", default: () => "'[]'" }) tags!: string[];
  @Column({ type: "jsonb", default: () => "'{}'" }) audience!: KnowledgeAudience;
  @Column({ type: "varchar", length: 20, default: "Low" }) severity!: KnowledgeSeverity;
  @Column({ type: "varchar", length: 20, default: "Medium" }) urgency!: string;

  @Column({ name: "author_id", type: "int", nullable: true }) authorId!: number | null;
  @Column({ name: "author_name", type: "varchar", length: 150, nullable: true }) authorName!: string | null;
  @Column({ name: "owner_name", type: "varchar", length: 150, nullable: true }) ownerName!: string | null;

  @Column({ type: "text", default: "" }) resolution!: string;
  @Column({ name: "workaround_status", type: "varchar", length: 20, default: "Draft" }) workaroundStatus!: WorkaroundStatus;
  @Column({ name: "permanent_fix_status", type: "varchar", length: 20, default: "Pending" }) permanentFixStatus!: string;
  /** Problem record this known error belongs to (problems.problem_code). */
  @Column({ name: "problem_code", type: "varchar", length: 40, nullable: true }) problemCode!: string | null;

  @Column({ type: "varchar", length: 20, default: "Published" }) status!: KnowledgeStatus;
  @Column({ type: "varchar", length: 20, default: "v1.0" }) version!: string;
  @Column({ name: "review_date", type: "date", nullable: true }) reviewDate!: Date | null;
  @Column({ name: "expiry_date", type: "date", nullable: true }) expiryDate!: Date | null;
  @Column({ type: "jsonb", default: () => "'[]'" }) reviewers!: string[];
  @Column({ name: "enable_self_service_portal", type: "boolean", default: true }) enableSelfServicePortal!: boolean;
  @Column({ name: "enable_analyst_console", type: "boolean", default: true }) enableAnalystConsole!: boolean;
  @Column({ type: "boolean", default: false }) featured!: boolean;
  @Column({ type: "boolean", default: false }) pinned!: boolean;
  @Column({ name: "include_search_index", type: "boolean", default: true }) includeSearchIndex!: boolean;
  @Column({ name: "allow_comments", type: "boolean", default: false }) allowComments!: boolean;
  @Column({ name: "capture_usage", type: "boolean", default: true }) captureUsage!: boolean;
  @Column({ name: "enable_rating", type: "boolean", default: true }) enableRating!: boolean;
  @Column({ name: "auto_suggest_incident", type: "boolean", default: true }) autoSuggestIncident!: boolean;
  @Column({ name: "enable_ai_summary_tags", type: "boolean", default: false }) enableAiSummaryTags!: boolean;
  @Column({ name: "enable_similar_suggestions", type: "boolean", default: false }) enableSimilarSuggestions!: boolean;
  @Column({ name: "allow_version_comparison", type: "boolean", default: false }) allowVersionComparison!: boolean;
  @Column({ name: "last_reviewed_at", type: "timestamp", default: () => "now()" }) lastReviewedAt!: Date;
  @Column({ name: "lifecycle_workflow_id", type: "int", nullable: true }) lifecycleWorkflowId!: number | null;

  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
