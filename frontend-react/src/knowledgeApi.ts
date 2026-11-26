import { api } from "./api";

export type ArticleType = "Standard KB" | "Known Error" | "Standard Change";
export type Severity = "Low" | "Medium" | "High" | "Critical";
export type ArticleStatus = "Draft" | "Published" | "Pending Archive" | "Archived";
export type Urgency = "Low" | "Medium" | "High";
export type WorkaroundStatus = "Draft" | "Pending" | "Verified";
export type HealthStatus = "Healthy" | "Review Due" | "Stale / Archive";

export interface Audience {
  targetUserGroup?: string;
  analystRole?: string;
  workgroup?: string;
  location?: string;
  department?: string;
}

export interface KnowledgeArticle {
  articleId: number;
  articleCode: string;
  articleType: ArticleType;
  title: string;
  summary: string | null;
  serviceLine: string | null;
  category: string | null;
  subcategory: string | null;
  service: string | null;
  configurationItem: string | null;
  relatedArticleCode: string | null;
  tags: string[];
  audience: Audience;
  severity: Severity;
  urgency: Urgency;
  priority: string;
  authorName: string | null;
  ownerName: string | null;
  resolution: string;
  workaroundStatus: WorkaroundStatus;
  permanentFixStatus: string;
  problemCode: string | null;
  status: ArticleStatus;
  version: string;
  reviewDate: string | null;
  expiryDate: string | null;
  reviewers: string[];
  enableSelfServicePortal: boolean;
  enableAnalystConsole: boolean;
  featured: boolean;
  pinned: boolean;
  includeSearchIndex: boolean;
  allowComments: boolean;
  captureUsage: boolean;
  enableRating: boolean;
  autoSuggestIncident: boolean;
  enableAiSummaryTags: boolean;
  enableSimilarSuggestions: boolean;
  allowVersionComparison: boolean;
  lifecycleWorkflowId: number | null;
  lastReviewedAt: string;
  createdAt: string;
  usageCount: number;
  health: HealthStatus;
}

export interface KnowledgeAttachment {
  attachmentId: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: number | null;
}

export interface KnowledgeLifecycleOption {
  workflowId: number;
  workflowName: string;
  description: string | null;
  isActive: boolean;
}

export interface KnowledgeSuggestion {
  articleId: number;
  articleCode: string;
  articleType: ArticleType;
  title: string;
  serviceLine: string | null;
  tags: string[];
  snippet: string;
  score: number;
  workaroundStatus?: WorkaroundStatus;
}

export interface SkmsDashboard {
  totalArticles: number;
  addedThisMonth: number;
  growthPct: number | null;
  deflectionRate: number | null;
  deflectionTarget: number;
  activeKnownErrors: number;
  pendingPatches: number;
  freshnessIndex: number | null;
  topAssets: KnowledgeArticle[];
  kcsLoop: { captureVelocity: number | null; structureQuality: number | null; problemToKedb: number | null };
}

export interface ArticleHealth {
  freshness: { fresh: number; reviewDue: number; stale: number; freshPct: number | null };
  deflectionDrivers: { articleCode: string; title: string; hits: number }[];
  feedback: {
    helpful: number; unhelpful: number; helpfulPct: number | null; unhelpfulPct: number | null;
    averageRating: number | null; flaggedArticles: number;
  };
  auditLog: KnowledgeArticle[];
}

export interface LeaderRow {
  rank: number; name: string; team: string | null;
  articlesCreated: number; articlesReused: number; qualityScore: number | null; points: number;
}

export interface SimStep {
  key: string; title: string; state: "done" | "warn"; detail: string;
  articles?: (KnowledgeArticle & { score: number })[];
}
export interface Simulation {
  incident: { incidentId: string; incidentCode: string | null; title: string };
  matchedArticle: KnowledgeArticle | null;
  steps: SimStep[];
}
export interface SimIncident { incidentId: string; incidentCode: string | null; title: string }

export interface NewArticleInput {
  articleType: ArticleType;
  title: string;
  summary?: string;
  serviceLine?: string;
  category?: string;
  subcategory?: string;
  service?: string;
  configurationItem?: string;
  relatedArticleCode?: string;
  tags: string[];
  audience: Audience;
  severity: Severity;
  urgency?: Urgency;
  authorName?: string;
  ownerName?: string;
  resolution: string;
  problemCode?: string;
  status?: ArticleStatus;
  version?: string;
  reviewDate?: string | null;
  expiryDate?: string | null;
  reviewers?: string[];
  enableSelfServicePortal?: boolean;
  enableAnalystConsole?: boolean;
  featured?: boolean;
  pinned?: boolean;
  includeSearchIndex?: boolean;
  allowComments?: boolean;
  captureUsage?: boolean;
  enableRating?: boolean;
  autoSuggestIncident?: boolean;
  enableAiSummaryTags?: boolean;
  enableSimilarSuggestions?: boolean;
  allowVersionComparison?: boolean;
  lifecycleWorkflowId?: number | null;
}

/** What an end user sees of an article: no author, severity, problem link or audience internals. */
export interface PortalArticle {
  articleId: number;
  articleCode: string;
  articleType: ArticleType;
  title: string;
  serviceLine: string | null;
  tags: string[];
  snippet: string;
  /** Only on the single-article response. */
  resolution?: string;
  enableRating: boolean;
  lastReviewedAt: string;
}

export type KnowledgeEventType = "reference" | "deflection" | "helpful" | "unhelpful";
/** recorded=false means the server saw it as a duplicate (same vote, same ticket link) and ignored it. */
export interface EventResult { ok: boolean; recorded: boolean }
export interface LinkedArticle extends KnowledgeArticle { linkedAt: string }

export const knowledgeApi = {
  dashboard: () => api.get<SkmsDashboard>("/knowledge/dashboard"),
  articles: (p: { type?: ArticleType; serviceLine?: string; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (p.type) qs.set("type", p.type);
    if (p.serviceLine) qs.set("serviceLine", p.serviceLine);
    if (p.q?.trim()) qs.set("q", p.q.trim());
    const s = qs.toString();
    return api.get<KnowledgeArticle[]>(`/knowledge/articles${s ? `?${s}` : ""}`);
  },
  article: (id: number) => api.get<KnowledgeArticle>(`/knowledge/articles/${id}`),
  attachments: (id: number) => api.get<KnowledgeAttachment[]>(`/knowledge/articles/${id}/attachments`),
  uploadAttachment: (id: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<KnowledgeAttachment>(`/knowledge/articles/${id}/attachments`, form);
  },
  deleteAttachment: (id: number, attachmentId: number) =>
    api.delete<{ deleted: boolean }>(`/knowledge/articles/${id}/attachments/${attachmentId}`),
  downloadAttachment: (id: number, attachment: KnowledgeAttachment) =>
    api.download(`/knowledge/articles/${id}/attachments/${attachment.attachmentId}/download`, attachment.fileName),
  serviceLines: () => api.get<string[]>("/knowledge/service-lines"),
  lifecycles: () => api.get<KnowledgeLifecycleOption[]>("/knowledge/lifecycles"),
  create: (input: NewArticleInput) => api.post<KnowledgeArticle>("/knowledge/articles", input),
  update: (id: number, input: NewArticleInput) => api.patch<KnowledgeArticle>(`/knowledge/articles/${id}`, input),
  suggestions: (q: string) => api.get<KnowledgeSuggestion[]>(`/knowledge/suggestions?q=${encodeURIComponent(q.trim())}`),
  setWorkaround: (id: number, status: WorkaroundStatus) =>
    api.patch<KnowledgeArticle>(`/knowledge/articles/${id}/workaround`, { status }),
  markReviewed: (id: number) => api.post<KnowledgeArticle>(`/knowledge/articles/${id}/review`),
  health: () => api.get<ArticleHealth>("/knowledge/health"),
  runAudit: () =>
    api.post<{ movedToPendingArchive: number; reviewDue: number; pendingArchive: number; ranAt: string }>("/knowledge/health/audit"),
  leaderboard: () => api.get<LeaderRow[]>("/knowledge/leaderboard"),
  simulatorIncidents: () => api.get<SimIncident[]>("/knowledge/simulator/incidents"),
  simulate: (ref: string) => api.get<Simulation>(`/knowledge/simulator/${encodeURIComponent(ref)}`),
  // Self-service portal (any signed-in user)
  portalArticles: (q = "") => api.get<PortalArticle[]>(`/knowledge/portal/articles${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`),
  portalArticle: (id: number) => api.get<PortalArticle>(`/knowledge/portal/articles/${id}`),
  /** reference needs an incident (staff linking an article to a ticket); the others are portal feedback. */
  recordEvent: (id: number, type: KnowledgeEventType, incidentId?: string) =>
    api.post<EventResult>(`/knowledge/articles/${id}/events`, { type, ...(incidentId ? { incidentId } : {}) }),
  incidentLinks: (incidentRef: string) => api.get<LinkedArticle[]>(`/knowledge/incidents/${encodeURIComponent(incidentRef)}/links`),
};
