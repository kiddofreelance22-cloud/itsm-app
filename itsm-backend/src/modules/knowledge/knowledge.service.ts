import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { KnowledgeArticle, WorkaroundStatus } from "./entities/knowledge-article.entity";
import { KnowledgeArticleEvent } from "./entities/knowledge-article-event.entity";
import { KnowledgeArticleAttachment } from "./entities/knowledge-article-attachment.entity";
import { CreateKnowledgeArticleDto, KnowledgeArticleQueryDto, KnowledgeEventDto, UpdateKnowledgeArticleDto } from "./dto/knowledge.dto";
import {
  PORTAL_ANALYST_ROLES, PORTAL_TARGET_GROUPS, escapeLike, healthOf, keywords, kcsPoints, matchScore,
  meetsStructureStandard, parseTags, pct, priorityFor, snippetOf,
} from "./knowledge.logic";

type Row = Record<string, any>;

@Injectable()
export class KnowledgeService {
  constructor(
    @InjectRepository(KnowledgeArticle) private readonly articles: Repository<KnowledgeArticle>,
    @InjectRepository(KnowledgeArticleEvent) private readonly events: Repository<KnowledgeArticleEvent>,
    @InjectRepository(KnowledgeArticleAttachment) private readonly attachmentsRepo: Repository<KnowledgeArticleAttachment>,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  // ------------------------------------------------------------------ mapping
  private toArticle(r: Row) {
    return {
      articleId: r.article_id,
      articleCode: r.article_code,
      articleType: r.article_type,
      title: r.title,
      summary: r.summary ?? null,
      serviceLine: r.service_line,
      category: r.category ?? null,
      subcategory: r.subcategory ?? null,
      service: r.service ?? null,
      configurationItem: r.configuration_item ?? null,
      relatedArticleCode: r.related_article_code ?? null,
      tags: r.tags ?? [],
      audience: r.audience ?? {},
      severity: r.severity,
      urgency: r.urgency ?? "Medium",
      priority: priorityFor(r.severity, r.urgency ?? "Medium"),
      authorName: r.author_name,
      ownerName: r.owner_name ?? null,
      resolution: r.resolution,
      workaroundStatus: r.workaround_status,
      permanentFixStatus: r.permanent_fix_status,
      problemCode: r.problem_code,
      status: r.status,
      version: r.version ?? "v1.0",
      reviewDate: r.review_date ?? null,
      expiryDate: r.expiry_date ?? null,
      reviewers: r.reviewers ?? [],
      enableSelfServicePortal: r.enable_self_service_portal ?? true,
      enableAnalystConsole: r.enable_analyst_console ?? true,
      featured: r.featured ?? false,
      pinned: r.pinned ?? false,
      includeSearchIndex: r.include_search_index ?? true,
      allowComments: r.allow_comments ?? false,
      captureUsage: r.capture_usage ?? true,
      enableRating: r.enable_rating ?? true,
      autoSuggestIncident: r.auto_suggest_incident ?? true,
      enableAiSummaryTags: r.enable_ai_summary_tags ?? false,
      enableSimilarSuggestions: r.enable_similar_suggestions ?? false,
      allowVersionComparison: r.allow_version_comparison ?? false,
      lifecycleWorkflowId: r.lifecycle_workflow_id ?? null,
      lastReviewedAt: r.last_reviewed_at,
      createdAt: r.created_at,
      usageCount: Number(r.refs ?? 0),
      health: healthOf(r.last_reviewed_at),
    };
  }

  private static readonly WITH_USAGE = `
    SELECT a.*, COALESCE(u.refs, 0)::int AS refs
    FROM knowledge_articles a
    LEFT JOIN (SELECT article_id, COUNT(*) AS refs FROM knowledge_article_events WHERE event_type = 'reference' GROUP BY article_id) u
      ON u.article_id = a.article_id`;

  // ------------------------------------------------------------------ articles
  async list(q: KnowledgeArticleQueryDto) {
    const where: string[] = [`a.status <> 'Archived'`];
    const params: unknown[] = [];
    if (q.type) { params.push(q.type); where.push(`a.article_type = $${params.length}`); }
    if (q.serviceLine) { params.push(q.serviceLine); where.push(`a.service_line = $${params.length}`); }
    if (q.q?.trim()) {
      params.push(`%${q.q.trim().toLowerCase()}%`);
      const n = params.length;
      where.push(`(LOWER(a.title) LIKE $${n} OR LOWER(a.article_code) LIKE $${n} OR LOWER(a.summary) LIKE $${n} OR LOWER(a.resolution) LIKE $${n} OR a.tags::text ILIKE $${n})`);
    }
    const rows: Row[] = await this.ds.query(
      `${KnowledgeService.WITH_USAGE} WHERE ${where.join(" AND ")} ORDER BY a.created_at DESC LIMIT 500`,
      params,
    );
    return rows.map((r) => this.toArticle(r));
  }

  async serviceLines(): Promise<string[]> {
    const rows: Row[] = await this.ds.query(
      `SELECT DISTINCT service_line FROM knowledge_articles WHERE service_line IS NOT NULL AND status <> 'Archived' ORDER BY service_line`,
    );
    return rows.map((r) => r.service_line);
  }

  async lifecycles() {
    const rows: Row[] = await this.ds.query(
      `SELECT workflow_id, workflow_name, description, is_active
       FROM workflows WHERE workflow_scope = 'knowledge' ORDER BY workflow_name`,
    );
    return rows.map((r) => ({
      workflowId: r.workflow_id,
      workflowName: r.workflow_name,
      description: r.description,
      isActive: r.is_active,
    }));
  }

  private async assertKnowledgeLifecycle(workflowId: number | null | undefined) {
    if (workflowId == null) return;
    const [workflow]: Row[] = await this.ds.query(
      `SELECT workflow_id FROM workflows WHERE workflow_id = $1 AND workflow_scope = 'knowledge'`,
      [workflowId],
    );
    if (!workflow) throw new BadRequestException("Select an existing Knowledge lifecycle.");
  }

  async findOne(id: number) {
    const rows: Row[] = await this.ds.query(`${KnowledgeService.WITH_USAGE} WHERE a.article_id = $1`, [id]);
    if (!rows.length) throw new NotFoundException("Article not found");
    return this.toArticle(rows[0]);
  }

  async listAttachments(articleId: number) {
    await this.assertArticle(articleId);
    const rows = await this.attachmentsRepo.find({ where: { articleId }, order: { uploadedAt: "DESC" } });
    return rows.map(({ attachmentId, fileName, mimeType, sizeBytes, uploadedAt, uploadedBy }) => ({
      attachmentId, fileName, mimeType, sizeBytes, uploadedAt, uploadedBy,
    }));
  }

  async listPortalAttachments(articleId: number) {
    await this.assertPortalArticle(articleId);
    return this.listAttachments(articleId);
  }

  async addAttachment(articleId: number, userId: number, file: Express.Multer.File) {
    await this.assertArticle(articleId);
    const saved = await this.attachmentsRepo.save(this.attachmentsRepo.create({
      articleId,
      fileName: file.originalname.slice(0, 255),
      storageName: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedBy: userId || null,
    }));
    return {
      attachmentId: saved.attachmentId,
      fileName: saved.fileName,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      uploadedAt: saved.uploadedAt,
      uploadedBy: saved.uploadedBy,
    };
  }

  async getAttachment(articleId: number, attachmentId: number) {
    const attachment = await this.attachmentsRepo.findOne({ where: { articleId, attachmentId } });
    if (!attachment) throw new NotFoundException("Attachment not found.");
    return attachment;
  }

  async getPortalAttachment(articleId: number, attachmentId: number) {
    await this.assertPortalArticle(articleId);
    return this.getAttachment(articleId, attachmentId);
  }

  async removeAttachment(articleId: number, attachmentId: number) {
    const attachment = await this.getAttachment(articleId, attachmentId);
    await this.attachmentsRepo.remove(attachment);
    return attachment;
  }

  private async assertArticle(articleId: number): Promise<void> {
    if (!(await this.articles.exist({ where: { articleId } }))) throw new NotFoundException("Article not found.");
  }

  private async assertPortalArticle(articleId: number): Promise<void> {
    const articles: Row[] = await this.ds.query(
      `SELECT a.article_id FROM knowledge_articles a
       WHERE ${KnowledgeService.PORTAL_WHERE} AND a.article_id = $3`,
      [PORTAL_TARGET_GROUPS, PORTAL_ANALYST_ROLES, articleId],
    );
    if (!articles.length) throw new NotFoundException("Article not found.");
  }

  async create(userId: number, dto: CreateKnowledgeArticleDto) {
    if ((dto.status ?? "Published") !== "Draft" && !dto.resolution?.trim()) {
      throw new BadRequestException("Resolution cannot be empty for a published article.");
    }
    if (dto.relatedArticleCode?.trim()) await this.assertRelatedKnownError(dto.relatedArticleCode.trim().toUpperCase());
    if (dto.reviewDate && dto.expiryDate && dto.expiryDate < dto.reviewDate) {
      throw new BadRequestException("Expiry date must be on or after the review date.");
    }
    await this.assertKnowledgeLifecycle(dto.lifecycleWorkflowId);
    const [me]: Row[] = userId ? await this.ds.query(`SELECT full_name FROM users WHERE user_id = $1`, [userId]) : [];
    const isKnownError = dto.articleType === "Known Error";
    const saved = await this.articles.save(
      this.articles.create({
        articleType: dto.articleType,
        title: dto.title.trim(),
        summary: dto.summary?.trim() || null,
        serviceLine: dto.serviceLine?.trim() || null,
        category: dto.category?.trim() || null,
        subcategory: dto.subcategory?.trim() || null,
        service: dto.service?.trim() || null,
        configurationItem: dto.configurationItem?.trim() || null,
        relatedArticleCode: dto.relatedArticleCode?.trim().toUpperCase() || null,
        tags: parseTags(dto.tags),
        audience: dto.audience ?? {},
        severity: dto.severity ?? "Low",
        urgency: dto.urgency ?? "Medium",
        authorId: userId ?? null,
        authorName: dto.authorName?.trim() || me?.full_name || null,
        ownerName: dto.ownerName?.trim() || null,
        resolution: dto.resolution?.trim() || "",
        // A known error's workaround is only "Verified" once somebody confirms it works.
        workaroundStatus: isKnownError ? "Pending" : "Verified",
        problemCode: isKnownError ? dto.problemCode?.trim() || null : null,
        status: dto.status ?? "Published",
        version: dto.version?.trim() || "v1.0",
        reviewDate: dto.reviewDate ? new Date(dto.reviewDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        lifecycleWorkflowId: dto.lifecycleWorkflowId ?? null,
        reviewers: (dto.reviewers ?? []).map((name) => name.trim()).filter(Boolean),
        enableSelfServicePortal: dto.enableSelfServicePortal ?? true,
        enableAnalystConsole: dto.enableAnalystConsole ?? true,
        featured: dto.featured ?? false,
        pinned: dto.pinned ?? false,
        includeSearchIndex: dto.includeSearchIndex ?? true,
        allowComments: dto.allowComments ?? false,
        captureUsage: dto.captureUsage ?? true,
        enableRating: dto.enableRating ?? true,
        autoSuggestIncident: dto.autoSuggestIncident ?? true,
        enableAiSummaryTags: dto.enableAiSummaryTags ?? false,
        enableSimilarSuggestions: dto.enableSimilarSuggestions ?? false,
        allowVersionComparison: dto.allowVersionComparison ?? false,
        lastReviewedAt: new Date(),
      }),
    );
    await this.articles.update(saved.articleId, { articleCode: `KB-${10000 + saved.articleId}` });
    return this.findOne(saved.articleId);
  }

  async update(id: number, dto: UpdateKnowledgeArticleDto) {
    const article = await this.articles.findOneBy({ articleId: id });
    if (!article) throw new NotFoundException("Article not found");
    if (dto.title !== undefined && !dto.title.trim()) throw new BadRequestException("Article title cannot be empty");
    const targetStatus = dto.status ?? "Published";
    if (targetStatus !== "Draft" && !(dto.resolution ?? article.resolution).trim()) {
      throw new BadRequestException("Resolution cannot be empty for a published article.");
    }
    if (dto.reviewDate && dto.expiryDate && dto.expiryDate < dto.reviewDate) {
      throw new BadRequestException("Expiry date must be on or after the review date.");
    }

    const articleType = dto.articleType ?? article.articleType;
    const relatedArticleCode = dto.relatedArticleCode === undefined ? article.relatedArticleCode : dto.relatedArticleCode.trim().toUpperCase() || null;
    if (relatedArticleCode) await this.assertRelatedKnownError(relatedArticleCode, id);
    const changes: Partial<KnowledgeArticle> = {};
    if (dto.articleType !== undefined) changes.articleType = dto.articleType;
    if (dto.title !== undefined) changes.title = dto.title.trim();
    if (dto.summary !== undefined) changes.summary = dto.summary.trim() || null;
    if (dto.serviceLine !== undefined) changes.serviceLine = dto.serviceLine.trim() || null;
    if (dto.category !== undefined) changes.category = dto.category.trim() || null;
    if (dto.subcategory !== undefined) changes.subcategory = dto.subcategory.trim() || null;
    if (dto.service !== undefined) changes.service = dto.service.trim() || null;
    if (dto.configurationItem !== undefined) changes.configurationItem = dto.configurationItem.trim() || null;
    if (dto.relatedArticleCode !== undefined) changes.relatedArticleCode = dto.relatedArticleCode.trim().toUpperCase() || null;
    if (dto.tags !== undefined) changes.tags = parseTags(dto.tags);
    if (dto.audience !== undefined) changes.audience = dto.audience;
    if (dto.severity !== undefined) changes.severity = dto.severity;
    if (dto.urgency !== undefined) changes.urgency = dto.urgency;
    if (dto.authorName !== undefined) changes.authorName = dto.authorName.trim() || null;
    if (dto.ownerName !== undefined) changes.ownerName = dto.ownerName.trim() || null;
    if (dto.resolution !== undefined) changes.resolution = dto.resolution.trim();
    if (dto.status !== undefined) changes.status = dto.status;
    else changes.status = "Published";
    if (dto.version !== undefined) changes.version = dto.version.trim() || "v1.0";
    if (dto.reviewDate !== undefined) changes.reviewDate = dto.reviewDate ? new Date(dto.reviewDate) : null;
    if (dto.expiryDate !== undefined) changes.expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;
    if (dto.lifecycleWorkflowId !== undefined) {
      await this.assertKnowledgeLifecycle(dto.lifecycleWorkflowId);
      changes.lifecycleWorkflowId = dto.lifecycleWorkflowId;
    }
    if (dto.reviewers !== undefined) changes.reviewers = dto.reviewers.map((name) => name.trim()).filter(Boolean);
    if (dto.enableSelfServicePortal !== undefined) changes.enableSelfServicePortal = dto.enableSelfServicePortal;
    if (dto.enableAnalystConsole !== undefined) changes.enableAnalystConsole = dto.enableAnalystConsole;
    if (dto.featured !== undefined) changes.featured = dto.featured;
    if (dto.pinned !== undefined) changes.pinned = dto.pinned;
    if (dto.includeSearchIndex !== undefined) changes.includeSearchIndex = dto.includeSearchIndex;
    if (dto.allowComments !== undefined) changes.allowComments = dto.allowComments;
    if (dto.captureUsage !== undefined) changes.captureUsage = dto.captureUsage;
    if (dto.enableRating !== undefined) changes.enableRating = dto.enableRating;
    if (dto.autoSuggestIncident !== undefined) changes.autoSuggestIncident = dto.autoSuggestIncident;
    if (dto.enableAiSummaryTags !== undefined) changes.enableAiSummaryTags = dto.enableAiSummaryTags;
    if (dto.enableSimilarSuggestions !== undefined) changes.enableSimilarSuggestions = dto.enableSimilarSuggestions;
    if (dto.allowVersionComparison !== undefined) changes.allowVersionComparison = dto.allowVersionComparison;
    changes.lastReviewedAt = new Date();
    changes.problemCode = articleType === "Known Error"
      ? dto.problemCode === undefined ? article.problemCode : dto.problemCode.trim() || null
      : null;

    const result = await this.articles.update(id, changes);
    if (!result.affected) throw new NotFoundException("Article not found");
    return this.findOne(id);
  }

  private async assertRelatedKnownError(code: string, articleId?: number) {
    const [related]: Row[] = await this.ds.query(
      `SELECT article_id, article_type FROM knowledge_articles WHERE article_code = $1`, [code]);
    if (!related || related.article_type !== "Known Error" || related.article_id === articleId) {
      throw new BadRequestException("Related Known Error must reference a different, existing Known Error article.");
    }
  }

  async setWorkaroundStatus(id: number, status: WorkaroundStatus) {
    if (!["Draft", "Pending", "Verified"].includes(status)) throw new BadRequestException("Invalid workaround status");
    const res = await this.articles.update(id, { workaroundStatus: status });
    if (!res.affected) throw new NotFoundException("Article not found");
    return this.findOne(id);
  }

  async markReviewed(id: number) {
    const res = await this.articles.update(id, { lastReviewedAt: new Date(), status: "Published" });
    if (!res.affected) throw new NotFoundException("Article not found");
    return this.findOne(id);
  }

  /**
   * Records reuse / deflection / rating, with the guards that keep the dashboard numbers honest:
   *  - reference: must name a real incident, and counts once per article per incident;
   *  - helpful / unhelpful: one vote per user per article (a new vote replaces the old one);
   *  - deflection: once per user per article per 24 hours.
   * Non-staff can only act on articles that the portal shows them.
   * Returns recorded=false when the event was a duplicate and was ignored.
   */
  async recordEvent(id: number, userId: number | null, dto: KnowledgeEventDto, staff = true) {
    if (staff) await this.findOne(id);
    else await this.portalFindOne(id);
    const [options]: Row[] = await this.ds.query(
      `SELECT capture_usage, enable_rating FROM knowledge_articles WHERE article_id = $1`, [id]);
    if (!options) throw new NotFoundException("Article not found");
    if ((dto.type === "helpful" || dto.type === "unhelpful") && !options.enable_rating) {
      throw new BadRequestException("Ratings are disabled for this article.");
    }

    let incidentId: string | null = null;
    if (dto.type === "reference") {
      if (!dto.incidentId?.trim()) throw new BadRequestException("A reference must name the incident the article was used on.");
      const [inc]: Row[] = await this.ds.query(
        `SELECT incident_id FROM incidents WHERE incident_id = $1 OR incident_code = $1 LIMIT 1`, [dto.incidentId.trim()]);
      if (!inc) throw new NotFoundException("Incident not found");
      incidentId = inc.incident_id; // always the id, never the code: the dashboard joins on it
    }
    if ((dto.type === "reference" || dto.type === "deflection") && !options.capture_usage) {
      return { ok: true, recorded: false };
    }

    return this.ds.transaction(async (m) => {
      if ((dto.type === "helpful" || dto.type === "unhelpful") && userId) {
        await m.query(
          `DELETE FROM knowledge_article_events WHERE article_id = $1 AND user_id = $2 AND event_type IN ('helpful', 'unhelpful')`,
          [id, userId]);
      }
      let guard = "";
      const params: unknown[] = [id, dto.type, incidentId, userId];
      if (dto.type === "reference") {
        guard = `WHERE NOT EXISTS (SELECT 1 FROM knowledge_article_events WHERE article_id = $1 AND event_type = 'reference' AND incident_id = $3)`;
      } else if (dto.type === "deflection" && userId) {
        guard = `WHERE NOT EXISTS (SELECT 1 FROM knowledge_article_events
                   WHERE article_id = $1 AND event_type = 'deflection' AND user_id = $4 AND created_at >= now() - interval '24 hours')`;
      }
      const inserted: Row[] = await m.query(
        `INSERT INTO knowledge_article_events (article_id, event_type, incident_id, user_id)
         SELECT $1::int, $2::varchar, $3::varchar, $4::int ${guard} RETURNING event_id`,
        params);
      return { ok: true, recorded: inserted.length > 0 };
    });
  }

  // ------------------------------------------------------------------ incident links (staff)
  /** Articles staff have linked to one ticket (reference events), newest first. */
  async incidentLinks(incidentRef: string) {
    const [inc]: Row[] = await this.ds.query(
      `SELECT incident_id FROM incidents WHERE incident_id = $1 OR incident_code = $1 LIMIT 1`, [incidentRef]);
    if (!inc) throw new NotFoundException("Incident not found");
    const rows: Row[] = await this.ds.query(
      `SELECT a.*, 0::int AS refs, e.created_at AS linked_at
       FROM knowledge_article_events e JOIN knowledge_articles a ON a.article_id = e.article_id
       WHERE e.event_type = 'reference' AND e.incident_id = $1 ORDER BY e.created_at DESC`,
      [inc.incident_id]);
    return rows.map((r) => ({ ...this.toArticle(r), linkedAt: r.linked_at }));
  }

  // ------------------------------------------------------------------ portal (end users)
  private static readonly PORTAL_WHERE = `
    a.status = 'Published'
    AND a.enable_self_service_portal = TRUE
    AND (a.expiry_date IS NULL OR a.expiry_date >= CURRENT_DATE)
    AND COALESCE(a.audience->>'targetUserGroup', '') = ANY($1::text[])
    AND COALESCE(a.audience->>'analystRole', '') = ANY($2::text[])`;

  /** What an end user may see: all published types allowed by audience rules, without staff-only metadata. */
  private toPortalArticle(r: Row, full: boolean) {
    return {
      articleId: r.article_id,
      articleCode: r.article_code,
      articleType: r.article_type,
      title: r.title,
      serviceLine: r.service_line,
      tags: r.tags ?? [],
      snippet: snippetOf(r.summary || r.resolution),
      ...(full ? { resolution: r.resolution } : {}),
      enableRating: r.enable_rating ?? true,
      lastReviewedAt: r.last_reviewed_at,
    };
  }

  /** Searchable list for the self-service Knowledge Base. With no query: the most-used articles first. */
  async portalList(q?: string) {
    const params: unknown[] = [PORTAL_TARGET_GROUPS, PORTAL_ANALYST_ROLES];
    const text = q?.trim().toLowerCase() ?? "";
    const words = text ? (keywords(text).length ? keywords(text) : [text]).slice(0, 8) : [];
    let search = "";
    if (words.length) {
      params.push(words.map((w) => `%${escapeLike(w)}%`));
      search = `AND a.include_search_index = TRUE
        AND (LOWER(a.title) LIKE ANY($3::text[]) OR LOWER(a.summary) LIKE ANY($3::text[])
          OR LOWER(a.resolution) LIKE ANY($3::text[]) OR a.tags::text ILIKE ANY($3::text[]))`;
    }
    const rows: Row[] = await this.ds.query(
      `${KnowledgeService.WITH_USAGE} WHERE ${KnowledgeService.PORTAL_WHERE} ${search} ORDER BY a.pinned DESC, a.featured DESC, refs DESC, a.created_at DESC LIMIT 200`,
      params);
    const ranked = words.length
      ? rows
          .map((r) => ({ r, score: matchScore(words, { title: r.title, tags: r.tags ?? [], resolution: `${r.summary ?? ""} ${r.resolution ?? ""}` }) }))
          .sort((a, b) => Number(b.r.pinned) - Number(a.r.pinned) || Number(b.r.featured) - Number(a.r.featured) || b.score - a.score || Number(b.r.refs) - Number(a.r.refs))
          .map((x) => x.r)
      : rows;
    return ranked.slice(0, 25).map((r) => this.toPortalArticle(r, false));
  }

  async portalFindOne(id: number) {
    const rows: Row[] = await this.ds.query(
      `SELECT a.* FROM knowledge_articles a WHERE ${KnowledgeService.PORTAL_WHERE} AND a.article_id = $3`,
      [PORTAL_TARGET_GROUPS, PORTAL_ANALYST_ROLES, id]);
    if (!rows.length) throw new NotFoundException("Article not found");
    return this.toPortalArticle(rows[0], true);
  }

  /** Keyword-ranked matches for incident creation. Non-staff only receive portal-visible articles. */
  async suggestions(q: string | undefined, staff: boolean) {
    const words = keywords(q ?? "");
    if (!words.length) return [];

    const patterns = words.map((word) => `%${escapeLike(word)}%`);
    const patternParam = staff ? "$1" : "$3";
    const rows: Row[] = await this.ds.query(
      `${KnowledgeService.WITH_USAGE}
       WHERE a.status = 'Published'
       AND (a.expiry_date IS NULL OR a.expiry_date >= CURRENT_DATE)
       AND a.include_search_index = TRUE
       AND a.auto_suggest_incident = TRUE
       ${staff ? "AND a.enable_analyst_console = TRUE" : `
         AND a.enable_self_service_portal = TRUE
         AND COALESCE(a.audience->>'targetUserGroup', '') = ANY($1::text[])
         AND COALESCE(a.audience->>'analystRole', '') = ANY($2::text[])`}
       AND (LOWER(a.title) LIKE ANY(${patternParam}::text[]) OR LOWER(a.summary) LIKE ANY(${patternParam}::text[])
         OR LOWER(a.resolution) LIKE ANY(${patternParam}::text[])
         OR a.tags::text ILIKE ANY(${patternParam}::text[]))
       ORDER BY a.pinned DESC, a.featured DESC, refs DESC, a.created_at DESC LIMIT 500`,
      staff ? [patterns] : [PORTAL_TARGET_GROUPS, PORTAL_ANALYST_ROLES, patterns],
    );
    return rows
      .map((r) => ({
        r,
        score: matchScore(words, { title: r.title, tags: r.tags ?? [], resolution: `${r.summary ?? ""} ${r.resolution ?? ""}` }),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => Number(b.r.pinned) - Number(a.r.pinned) || Number(b.r.featured) - Number(a.r.featured) || b.score - a.score || Number(b.r.refs) - Number(a.r.refs) || new Date(b.r.created_at).getTime() - new Date(a.r.created_at).getTime())
      .slice(0, 3)
      .map(({ r, score }) => ({
        articleId: r.article_id,
        articleCode: r.article_code,
        articleType: r.article_type,
        title: r.title,
        serviceLine: r.service_line,
        tags: r.tags ?? [],
        snippet: snippetOf(r.resolution ?? ""),
        score: Math.min(100, Math.round((score / (words.length * 5)) * 100)),
        ...(staff ? { workaroundStatus: r.workaround_status } : {}),
      }));
  }

  // ------------------------------------------------------------------ dashboard
  async dashboard() {
    const [t]: Row[] = await this.ds.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'Published')::int AS total,
        COUNT(*) FILTER (WHERE status = 'Published' AND created_at >= date_trunc('month', now()))::int AS this_month,
        COUNT(*) FILTER (WHERE status = 'Published' AND article_type = 'Known Error')::int AS known_errors,
        COUNT(*) FILTER (WHERE status = 'Published' AND article_type = 'Known Error' AND permanent_fix_status = 'Pending')::int AS pending_fix,
        COUNT(*) FILTER (WHERE status = 'Published' AND last_reviewed_at >= now() - interval '90 days')::int AS fresh
      FROM knowledge_articles`);

    const [{ deflected }]: Row[] = await this.ds.query(
      `SELECT COUNT(*)::int AS deflected FROM knowledge_article_events WHERE event_type = 'deflection' AND created_at >= now() - interval '30 days'`);
    const [{ tickets }]: Row[] = await this.ds.query(
      `SELECT COUNT(*)::int AS tickets FROM incidents WHERE created_at >= now() - interval '30 days'`);

    const [cap]: Row[] = await this.ds.query(`
      SELECT COUNT(*)::int AS resolved,
             COUNT(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM knowledge_article_events e WHERE e.incident_id = i.incident_id AND e.event_type = 'reference'
             ))::int AS with_article
      FROM incidents i
      WHERE i.status IN ('Resolved', 'Closed') AND COALESCE(i.resolved_at, i.created_at) >= now() - interval '30 days'`);

    const [prob]: Row[] = await this.ds.query(`
      SELECT COUNT(*)::int AS problems,
             COUNT(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM knowledge_articles a
               WHERE a.problem_code = p.problem_code AND a.article_type = 'Known Error' AND a.status = 'Published'
             ))::int AS with_ke
      FROM problems p`);

    const published: Row[] = await this.ds.query(
      `SELECT title, tags, service_line, resolution FROM knowledge_articles WHERE status = 'Published'`);
    const structured = published.filter((a) =>
      meetsStructureStandard({ title: a.title, tags: a.tags ?? [], serviceLine: a.service_line, resolution: a.resolution })).length;

    const top: Row[] = await this.ds.query(`
      SELECT * FROM (
        (${KnowledgeService.WITH_USAGE} WHERE a.status = 'Published' ORDER BY refs DESC, a.created_at DESC LIMIT 5)
        UNION
        (${KnowledgeService.WITH_USAGE} WHERE a.status = 'Published' ORDER BY a.created_at DESC LIMIT 5)
      ) assets
      ORDER BY refs DESC, created_at DESC LIMIT 10`);

    const previous = t.total - t.this_month;
    return {
      totalArticles: t.total,
      addedThisMonth: t.this_month,
      growthPct: previous > 0 ? Math.round((t.this_month / previous) * 100) : null,
      deflectionRate: pct(deflected, deflected + tickets),
      deflectionTarget: 40,
      activeKnownErrors: t.known_errors,
      pendingPatches: t.pending_fix,
      freshnessIndex: pct(t.fresh, t.total),
      topAssets: top.map((r) => this.toArticle(r)),
      kcsLoop: {
        captureVelocity: pct(cap.with_article, cap.resolved),
        structureQuality: pct(structured, published.length),
        problemToKedb: pct(prob.with_ke, prob.problems),
      },
    };
  }

  // ------------------------------------------------------------------ article health
  async health() {
    const [f]: Row[] = await this.ds.query(`
      SELECT
        COUNT(*) FILTER (WHERE last_reviewed_at >= now() - interval '90 days')::int AS fresh,
        COUNT(*) FILTER (WHERE last_reviewed_at < now() - interval '90 days' AND last_reviewed_at >= now() - interval '180 days')::int AS due,
        COUNT(*) FILTER (WHERE last_reviewed_at < now() - interval '180 days')::int AS stale,
        COUNT(*)::int AS total
      FROM knowledge_articles WHERE status = 'Published'`);

    const [v]: Row[] = await this.ds.query(`
      SELECT COUNT(*) FILTER (WHERE event_type = 'helpful')::int AS helpful,
             COUNT(*) FILTER (WHERE event_type = 'unhelpful')::int AS unhelpful
      FROM knowledge_article_events`);

    const [flagged]: Row[] = await this.ds.query(`
      SELECT COUNT(*)::int AS n FROM (
        SELECT article_id FROM knowledge_article_events
        GROUP BY article_id
        HAVING COUNT(*) FILTER (WHERE event_type = 'unhelpful') >= 3
           AND COUNT(*) FILTER (WHERE event_type = 'unhelpful') > COUNT(*) FILTER (WHERE event_type = 'helpful')
      ) x`);

    const drivers: Row[] = await this.ds.query(`
      SELECT a.article_code, a.title, COUNT(*)::int AS hits
      FROM knowledge_article_events e JOIN knowledge_articles a ON a.article_id = e.article_id
      WHERE e.event_type = 'deflection' AND e.created_at >= now() - interval '30 days'
      GROUP BY a.article_id ORDER BY hits DESC LIMIT 3`);

    const log: Row[] = await this.ds.query(
      `${KnowledgeService.WITH_USAGE} WHERE a.status <> 'Archived' ORDER BY a.last_reviewed_at DESC LIMIT 25`);

    const votes = v.helpful + v.unhelpful;
    return {
      freshness: { fresh: f.fresh, reviewDue: f.due, stale: f.stale, freshPct: pct(f.fresh, f.total) },
      deflectionDrivers: drivers.map((d) => ({ articleCode: d.article_code, title: d.title, hits: d.hits })),
      feedback: {
        helpful: v.helpful,
        unhelpful: v.unhelpful,
        helpfulPct: pct(v.helpful, votes),
        unhelpfulPct: pct(v.unhelpful, votes),
        averageRating: votes ? Math.round((v.helpful / votes) * 50) / 10 : null,
        flaggedArticles: flagged.n,
      },
      auditLog: log.map((r) => this.toArticle(r)),
    };
  }

  /** Freshness audit: anything not reviewed for over 180 days moves to "Pending Archive" until someone re-reviews it. */
  async runFreshnessAudit() {
    // TypeORM returns UPDATE ... RETURNING from Postgres as [rows, rowCount], not as the rows themselves.
    const [moved]: [Row[], number] = await this.ds.query(`
      UPDATE knowledge_articles SET status = 'Pending Archive', updated_at = now()
      WHERE status = 'Published' AND last_reviewed_at < now() - interval '180 days'
      RETURNING article_code`);
    const [c]: Row[] = await this.ds.query(`
      SELECT COUNT(*) FILTER (WHERE status = 'Published' AND last_reviewed_at < now() - interval '90 days')::int AS review_due,
             COUNT(*) FILTER (WHERE status = 'Pending Archive')::int AS pending_archive
      FROM knowledge_articles`);
    return { movedToPendingArchive: moved.length, reviewDue: c.review_due, pendingArchive: c.pending_archive, ranAt: new Date().toISOString() };
  }

  // ------------------------------------------------------------------ leaderboard
  async leaderboard() {
    const rows: Row[] = await this.ds.query(`
      SELECT COALESCE(a.author_id::text, LOWER(a.author_name)) AS author_key,
             COALESCE(MAX(u.full_name), MAX(a.author_name), 'Unknown') AS name,
             MAX(u.job_title) AS team,
             COUNT(DISTINCT a.article_id)::int AS created,
             COUNT(e.event_id) FILTER (WHERE e.event_type = 'reference')::int AS reused,
             COUNT(e.event_id) FILTER (WHERE e.event_type = 'helpful')::int AS helpful,
             COUNT(e.event_id) FILTER (WHERE e.event_type = 'unhelpful')::int AS unhelpful
      FROM knowledge_articles a
      LEFT JOIN users u ON u.user_id = a.author_id
      LEFT JOIN knowledge_article_events e ON e.article_id = a.article_id
      WHERE a.status <> 'Archived' AND (a.author_id IS NOT NULL OR a.author_name IS NOT NULL)
      GROUP BY 1`);
    return rows
      .map((r) => ({
        name: r.name,
        team: r.team,
        articlesCreated: r.created,
        articlesReused: r.reused,
        qualityScore: pct(r.helpful, r.helpful + r.unhelpful),
        points: kcsPoints(r.created, r.reused, r.helpful),
      }))
      .sort((a, b) => b.points - a.points || b.articlesCreated - a.articlesCreated)
      .slice(0, 25)
      .map((r, i) => ({ rank: i + 1, ...r }));
  }

  // ------------------------------------------------------------------ workflow simulator
  async simulatorIncidents() {
    const rows: Row[] = await this.ds.query(
      `SELECT incident_id, incident_code, title FROM incidents ORDER BY created_at DESC LIMIT 50`);
    return rows.map((r) => ({ incidentId: r.incident_id, incidentCode: r.incident_code, title: r.title }));
  }

  /**
   * Read-only trace of how knowledge connects to Incident, Problem and Change for one ticket.
   * Nothing is written: it only reports what the live data would do.
   */
  async simulate(incidentRef: string) {
    const [inc]: Row[] = await this.ds.query(
      `SELECT incident_id, incident_code, title, description, priority, status FROM incidents WHERE incident_id = $1 OR incident_code = $1 LIMIT 1`,
      [incidentRef]);
    if (!inc) throw new NotFoundException("Incident not found");

    const words = keywords(`${inc.title} ${inc.description ?? ""}`);
    const pool: Row[] = await this.ds.query(`${KnowledgeService.WITH_USAGE} WHERE a.status = 'Published'`);
    const ranked = pool
      .map((r) => ({ r, score: matchScore(words, { title: r.title, tags: r.tags ?? [], resolution: r.resolution ?? "" }) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || Number(b.r.refs) - Number(a.r.refs));
    const matches = ranked.slice(0, 3).map((x) => ({ ...this.toArticle(x.r), score: x.score }));
    const knownError = ranked.find((x) => x.r.article_type === "Known Error");

    // Problem: the known error's own problem, else the closest open problem by description.
    let problem: Row | undefined;
    if (knownError?.r.problem_code) {
      [problem] = await this.ds.query(`SELECT problem_code, short_description, status FROM problems WHERE problem_code = $1`, [knownError.r.problem_code]);
    }
    if (!problem && words.length) {
      const likes = words.slice(0, 6).map((w) => `%${w}%`);
      [problem] = await this.ds.query(
        `SELECT problem_code, short_description, status FROM problems
         WHERE status IN ('Open', 'In Progress') AND LOWER(short_description) LIKE ANY($1::text[]) ORDER BY created_at DESC LIMIT 1`,
        [likes]);
    }

    // Change: an Active standard change template that fits the ticket, from Change Management configuration.
    const [setting]: Row[] = await this.ds.query(`SELECT value FROM change_settings WHERE setting_key = 'templates'`);
    const templates: any[] = Array.isArray(setting?.value) ? setting.value : [];
    const template = templates
      .filter((tpl) => tpl.status === "Active")
      .map((tpl) => ({
        tpl,
        score: matchScore(words, { title: `${tpl.name} ${tpl.service ?? ""}`, tags: [String(tpl.category ?? "")], resolution: tpl.description ?? "" }),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.tpl;

    const steps = [
      {
        key: "incident", title: "Incident captured", state: "done",
        detail: `${inc.incident_code ?? inc.incident_id} — ${inc.title} (${inc.priority}, ${inc.status})`,
      },
      {
        key: "search", title: "Knowledge search", state: matches.length ? "done" : "warn",
        detail: matches.length
          ? `${matches.length} candidate article${matches.length > 1 ? "s" : ""} found from the ticket's keywords.`
          : "No published article matches this ticket.",
        articles: matches,
      },
      {
        key: "kedb", title: "Known Error link", state: knownError ? "done" : "warn",
        detail: knownError
          ? `${knownError.r.article_code} is a Known Error with a ${String(knownError.r.workaround_status).toLowerCase()} workaround.`
          : "No Known Error matches. If a root cause is found, record one in the KEDB.",
      },
      {
        key: "problem", title: "Problem record", state: problem ? "done" : "warn",
        detail: problem
          ? `${problem.problem_code} — ${problem.short_description} (${problem.status}).`
          : "No open Problem matches. A Problem record should be raised for root-cause analysis.",
      },
      {
        key: "change", title: "Standard change for the permanent fix", state: template ? "done" : "warn",
        detail: template
          ? `Standard change "${template.name}" can deploy the fix.`
          : "No Active standard change fits. The permanent fix would go through a Normal change.",
      },
      {
        key: "capture", title: "KCS capture", state: matches.length ? "done" : "warn",
        detail: matches.length
          ? "Link the best article to the ticket on resolution so its reuse is counted."
          : "On resolution, create a new article from this ticket's fix (Solve-Evolve loop).",
      },
    ];
    return {
      incident: { incidentId: inc.incident_id, incidentCode: inc.incident_code, title: inc.title },
      matchedArticle: matches[0] ?? null,
      steps,
    };
  }
}
