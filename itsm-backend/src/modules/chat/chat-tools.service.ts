import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { Catalog } from "../catalogs/entities/catalog.entity";
import { CatalogVariable } from "../catalogs/entities/catalog-variable.entity";
import { Category } from "../categories/entities/category.entity";
import { Classification } from "../itsm-config/entities/classification.entity";
import { Impact } from "../impact/entities/impact.entity";
import { Incident } from "../incidents/entities/incident.entity";
import { IncidentsService } from "../incidents/incidents.service";
import { CreateIncidentDto } from "../incidents/dto/create-incident.dto";
import { Priority } from "../priority/entities/priority.entity";
import { RequestsService } from "../requests/requests.service";
import { CreateRequestDto } from "../requests/dto/create-request.dto";
import { ServiceRequest } from "../requests/entities/request.entity";
import { SubCategory } from "../sub-category/entities/sub-category.entity";
import { Urgency } from "../urgency/entities/urgency.entity";
import { ChatKnowledgeService } from "./chat-knowledge.service";
import { ChatPendingAction, ChatPendingActionKind } from "./entities/chat-pending-action.entity";
import { ChatSession } from "./entities/chat.entity";
import { maskPii } from "./pii-mask";
import { isStaff } from "../../common/utils/roles.util";

type ToolResult = Record<string, unknown>;

/** The model may only call these explicitly-scoped tools. */
export const TOOL_DEFS = [
  {
    name: "search_knowledge",
    description: "Search company policies and how-to documents. Use for 'how do I…' and policy questions.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "What the user wants to know" } }, required: ["query"], additionalProperties: false },
  },
  {
    name: "search_catalog",
    description: "Search published service catalog items. Use for questions about products, access, or services users can request.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
  },
  {
    name: "get_my_tickets",
    description: "Look up only the signed-in user's incidents and service requests. Optionally pass a ticket number.",
    input_schema: { type: "object", properties: { reference: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "suggest_ticket_details",
    description: "Suggest category, sub-category, impact, urgency, priority and similar incidents using real database values and incidents the signed-in user may see. Use for problem reports before drafting.",
    input_schema: { type: "object", properties: { description: { type: "string" } }, required: ["description"], additionalProperties: false },
  },
  {
    name: "draft_incident",
    description: "Prepare, but never submit, a new incident for the signed-in user. Use when the user describes a problem or asks to report one. Include only facts they gave; category/impact/urgency are optional and must be user-provided or suggested from real database options. The user must confirm with the card.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        category: { type: "string" },
        subCategory: { type: "string" },
        classification: { type: "string" },
        impact: { type: "string" },
        urgency: { type: "string" },
        contactType: { type: "string", enum: ["Self-Service Portal", "Email", "Phone", "Chat"] },
      },
      required: ["title", "description"],
      additionalProperties: false,
    },
  },
  {
    name: "draft_service_request",
    description: "Prepare, but never submit, a request for a published catalog item and its required form answers. The user must confirm with the card.",
    input_schema: {
      type: "object",
      properties: {
        catalogItem: { type: "string" },
        answers: { type: "array", items: { type: "object", properties: { field: { type: "string" }, value: { type: "string" } }, required: ["field", "value"], additionalProperties: false } },
      },
      required: ["catalogItem", "answers"],
      additionalProperties: false,
    },
  },
  {
    name: "draft_ticket_update",
    description: "Prepare a confirmation-only update to the signed-in user's incident. Allowed change types: public_comment, work_note (staff only), information, contact_number, and reopen (Resolved incidents only). Never approve, reject, resolve, close, or delete tickets.",
    input_schema: {
      type: "object",
      properties: {
        ticketNumber: { type: "string" },
        change: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["public_comment", "work_note", "information", "contact_number", "reopen"] },
            value: { type: "string" },
          },
          required: ["type"],
          additionalProperties: false,
        },
      },
      required: ["ticketNumber", "change"],
      additionalProperties: false,
    },
  },
  {
    name: "summarize_ticket",
    description: "For authorized Resolver, Analyst, Engineer, IT Agent, or Admin staff only. Summarize a ticket's real description, activity timeline, work done, and current status.",
    input_schema: { type: "object", properties: { ticketNumber: { type: "string" } }, required: ["ticketNumber"], additionalProperties: false },
  },
  {
    name: "suggest_fixes",
    description: "For authorized Resolver, Analyst, Engineer, IT Agent, or Admin staff only. Find similar resolved incidents and return their recorded resolution notes; never invent fixes.",
    input_schema: { type: "object", properties: { ticketNumber: { type: "string" } }, required: ["ticketNumber"], additionalProperties: false },
  },
  {
    name: "handover_to_service_desk",
    description: "Create an incident assigned to the active Service Desk group when the user asks for a person, is upset, or the assistant cannot help. Provide a brief reason; the server adds a masked chat summary.",
    input_schema: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"], additionalProperties: false },
  },
];

@Injectable()
export class ChatToolsService {
  constructor(
    @InjectRepository(Catalog) private readonly catalogs: Repository<Catalog>,
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    @InjectRepository(ServiceRequest) private readonly requests: Repository<ServiceRequest>,
    @InjectRepository(CatalogVariable) private readonly variables: Repository<CatalogVariable>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Classification) private readonly classifications: Repository<Classification>,
    @InjectRepository(SubCategory) private readonly subCategories: Repository<SubCategory>,
    @InjectRepository(Impact) private readonly impacts: Repository<Impact>,
    @InjectRepository(Urgency) private readonly urgencies: Repository<Urgency>,
    @InjectRepository(Priority) private readonly priorities: Repository<Priority>,
    @InjectRepository(ChatPendingAction) private readonly pendingActions: Repository<ChatPendingAction>,
    private readonly knowledge: ChatKnowledgeService,
    private readonly incidentsService: IncidentsService,
    private readonly requestsService: RequestsService,
  ) {}

  async run(
    name: string,
    input: unknown,
    userId: number,
    sessionId: string,
    roles: string[] = [],
    context: { chatSummary?: string } = {},
  ): Promise<unknown> {
    if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Tool input must be an object." };
    const data = input as Record<string, unknown>;
    const keys: Record<string, string[]> = {
      search_knowledge: ["query"],
      search_catalog: ["query"],
      get_my_tickets: ["reference"],
      suggest_ticket_details: ["description"],
      draft_incident: ["title", "description", "category", "subCategory", "classification", "impact", "urgency", "contactType"],
      draft_service_request: ["catalogItem", "answers"],
      draft_ticket_update: ["ticketNumber", "change"],
      summarize_ticket: ["ticketNumber"],
      suggest_fixes: ["ticketNumber"],
      handover_to_service_desk: ["reason"],
    };
    const accepted = keys[name];
    if (!accepted) return { error: "Unknown tool." };
    if (Object.keys(data).some((key) => !accepted.includes(key))) {
      throw new BadRequestException("Tool input contains unsupported fields.");
    }
    switch (name) {
      case "search_knowledge": {
        const q = this.text(data.query, 200);
        const hits = this.knowledge.search(q);
        return hits.length
          ? hits.map((h) => ({ source: h.source, text: h.text }))
          : { result: "No matching policy or how-to document was found." };
      }
      case "search_catalog": return this.searchCatalog(this.text(data.query, 200));
      case "get_my_tickets": return this.myTickets(userId, this.text(data.reference, 40, true), roles);
      case "suggest_ticket_details": return this.suggestTicketDetails(this.text(data.description, 2000), userId, roles);
      case "draft_incident": return this.draftIncident(data, userId, sessionId, roles);
      case "draft_service_request": return this.draftServiceRequest(data, userId, sessionId);
      case "draft_ticket_update": return this.draftTicketUpdate(data, userId, sessionId, roles);
      case "summarize_ticket": return this.summarizeTicket(this.text(data.ticketNumber, 40), userId, roles);
      case "suggest_fixes": return this.suggestFixes(this.text(data.ticketNumber, 40), userId, roles);
      case "handover_to_service_desk": return this.handover(this.text(data.reason, 500), context.chatSummary, userId, roles);
      default: return { error: "Unknown tool." };
    }
  }

  private text(value: unknown, maxLength: number, optional = false): string {
    if (value === undefined && optional) return "";
    if (typeof value !== "string") throw new BadRequestException("Tool text input is invalid.");
    const text = value.trim();
    if (!optional && !text) throw new BadRequestException("A required tool field is missing.");
    if (text.length > maxLength) throw new BadRequestException(`Tool text must be ${maxLength} characters or fewer.`);
    return text;
  }

  private async draftIncident(input: Record<string, unknown>, userId: number, sessionId: string, roles: string[]): Promise<ToolResult> {
    const title = maskPii(this.text(input.title, 200, true));
    const description = maskPii(this.text(input.description, 4000, true));
    const categoryName = maskPii(this.text(input.category, 160, true));
    const subCategoryName = maskPii(this.text(input.subCategory, 160, true));
    const classificationName = maskPii(this.text(input.classification, 150, true));
    const impactName = this.text(input.impact, 80, true);
    const urgencyName = this.text(input.urgency, 80, true);
    const contactType = this.text(input.contactType, 40, true);

    const dto: CreateIncidentDto = { title, description };
    const suggestion = description
      ? await this.suggestTicketDetails(description, userId, roles)
      : null;
    if (categoryName) {
      const category = await this.categories.findOne({
        where: { categoryName: ILike(categoryName), isActive: true, allowInIncident: true },
      });
      if (!category) {
        const available = await this.categories.find({
          where: { isActive: true, allowInIncident: true },
          order: { displayOrder: "ASC", categoryId: "ASC" },
          take: 100,
        });
        return { error: "Choose an incident category from the available list.", categories: available.map((item) => item.categoryName) };
      }
      dto.categoryId = category.categoryId;
    } else if (suggestion?.category) {
      dto.categoryId = suggestion.category.id;
    }
    const selectedCategory = dto.categoryId
      ? await this.categories.findOne({ where: { categoryId: dto.categoryId, isActive: true, allowInIncident: true } })
      : null;
    const selectedCategoryName = selectedCategory?.categoryName ?? null;
    if (subCategoryName) {
      if (!dto.categoryId) return { error: "Select a real incident category before choosing a sub-category." };
      const subCategory = await this.subCategories.findOne({
        where: { subCategoryName: ILike(subCategoryName), category: { categoryId: dto.categoryId }, isActive: true },
      });
      if (!subCategory) return { error: "The sub-category must belong to the selected incident category." };
      dto.subCategoryId = subCategory.subCategoryId;
    } else if (suggestion?.subCategory && suggestion.category?.id === dto.categoryId) {
      dto.subCategoryId = suggestion.subCategory.id;
    }
    if (classificationName) {
      const classification = await this.classifications.findOne({
        where: { name: ILike(classificationName), isActive: true },
      });
      if (!classification) {
        const available = await this.classifications.find({
          where: { isActive: true },
          order: { name: "ASC" },
          take: 100,
        });
        return {
          error: "Choose an incident classification from the available list.",
          classifications: available.map((item) => ({ id: item.classificationId, name: item.name })),
        };
      }
      dto.classificationId = classification.classificationId;
    }
    const selectedImpact = impactName || suggestion?.impact?.name;
    if (selectedImpact) {
      const impact = await this.impacts.findOne({ where: { impactName: ILike(selectedImpact), isActive: true } });
      if (!impact) return { error: "Impact must match an active impact in the system." };
      dto.impact = impact.impactName;
    }
    const selectedUrgency = urgencyName || suggestion?.urgency?.name;
    if (selectedUrgency) {
      const urgency = await this.urgencies.findOne({ where: { urgencyName: ILike(selectedUrgency), isActive: true } });
      if (!urgency) return { error: "Urgency must match an active urgency in the system." };
      dto.urgency = urgency.urgencyName;
    }
    if (contactType) {
      if (!["Self-Service Portal", "Email", "Phone", "Chat"].includes(contactType)) {
        return { error: "Contact type must be selected from the available options." };
      }
      dto.contactType = contactType;
    } else {
      dto.contactType = "Self-Service Portal";
    }

    const derivedPriority = dto.impact && dto.urgency
      ? await this.incidentsService.suggestPriority(dto.impact, dto.urgency)
      : null;
    const fallbackPriorities = derivedPriority ? [] : await this.priorities.find({
      where: { isActive: true },
      order: { order: "ASC" },
      take: 100,
    });
    dto.priority = derivedPriority ?? fallbackPriorities.find((item) => item.priorityName.toLowerCase() === "medium")?.priorityName
      ?? fallbackPriorities[0]?.priorityName
      ?? "Medium";
    const validation = await this.incidentsService.validateChatDraft(dto, roles);
    const allMissingFields = [...new Set([
      ...validation.missingFields,
      ...(!title ? ["Short Description"] : []),
      ...(!description ? ["Description"] : []),
    ])];
    const missingFields = allMissingFields.slice(0, 2);
    const preview = {
      ...dto,
      categoryName: selectedCategoryName,
      derivedPriority,
      missingFields,
      suggestion,
      categoryOptions: (suggestion?.categoryOptions as unknown[]) ?? [],
      subCategoryOptions: (suggestion?.subCategoryOptions as unknown[]) ?? [],
      impactOptions: (suggestion?.impactOptions as unknown[]) ?? [],
      urgencyOptions: (suggestion?.urgencyOptions as unknown[]) ?? [],
      classificationOptions: (await this.classifications.find({
        where: { isActive: true },
        order: { name: "ASC" },
        take: 100,
      })).map((item) => ({ id: item.classificationId, name: item.name })),
      contactTypeOptions: ["Self-Service Portal", "Email", "Phone", "Chat"],
    };
    const action = await this.saveDraft(sessionId, userId, "incident", { draft: dto, preview });
    return { actionId: action.id, kind: action.kind, preview, expiresAt: action.expiresAt };
  }

  private async draftServiceRequest(input: Record<string, unknown>, userId: number, sessionId: string): Promise<ToolResult> {
    const name = maskPii(this.text(input.catalogItem, 200, true));
    if (!Array.isArray(input.answers) || input.answers.length > 50) {
      throw new BadRequestException("Request answers must be a list of at most 50 fields.");
    }

    const rows = name
      ? await this.catalogs.find({
          where: [{ catalogName: ILike(name) }, { shortDescription: ILike(name) }]
            .map((where) => ({ ...where, isActive: true, status: "published" })),
          take: 6,
        })
      : [];
    const catalog = rows.find((row) => row.catalogName.toLowerCase() === name.toLowerCase());
    if (!catalog) {
      return {
        error: name ? "No exact published catalog item was found. Ask which item the user wants." : "Ask the user which catalog item they want.",
        matches: rows.slice(0, 5).map((row) => ({ catalogId: row.catalogId, name: row.catalogName })),
      };
    }

    const variables = await this.variables.find({
      where: { catalog: { catalogId: catalog.catalogId }, isActive: true, isVisible: true },
      order: { sortOrder: "ASC", variableId: "ASC" },
    });
    const answers: Array<{ field: string; value: string }> = [];
    for (const raw of input.answers as unknown[]) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BadRequestException("A request answer is invalid.");
      const item = raw as Record<string, unknown>;
      const field = this.text(item.field, 160);
      const value = maskPii(this.text(item.value, 2000));
      const variable = variables.find((candidate) => candidate.label.toLowerCase() === field.toLowerCase());
      if (!variable) return { error: `The field "${field}" is not part of this catalog form.` };
      answers.push({ field: variable.label, value });
    }
    const seen = new Set<string>();
    for (const answer of answers) {
      const normalized = answer.field.toLowerCase();
      if (seen.has(normalized)) throw new BadRequestException(`The field "${answer.field}" was answered more than once.`);
      seen.add(normalized);
    }
    const variableValues = answers.map((answer) => ({
      variableId: variables.find((variable) => variable.label === answer.field)!.variableId,
      value: answer.value,
    }));
    const validation = await this.requestsService.validateChatDraft(catalog.catalogId, variableValues);
    const preview = {
      catalogId: catalog.catalogId,
      catalogName: catalog.catalogName,
      variableValues,
      answers,
      variables: validation.variables,
      missingFields: validation.missingFields.slice(0, 2),
      requestPath: validation.preview,
    };
    const dto: CreateRequestDto = { catalogId: catalog.catalogId, variableValues };
    const action = await this.saveDraft(sessionId, userId, "service_request", { draft: dto, preview });
    return { actionId: action.id, kind: action.kind, preview, expiresAt: action.expiresAt };
  }

  private async draftTicketUpdate(input: Record<string, unknown>, userId: number, sessionId: string, roles: string[]): Promise<ToolResult> {
    const ticketNumber = this.text(input.ticketNumber, 40).toUpperCase();
    if (!input.change || typeof input.change !== "object" || Array.isArray(input.change)) {
      throw new BadRequestException("Ticket change is invalid.");
    }
    const change = input.change as Record<string, unknown>;
    const changeType = this.text(change.type, 40);
    const allowed = new Set(["public_comment", "work_note", "information", "contact_number", "reopen"]);
    if (!allowed.has(changeType) || Object.keys(change).some((key) => !["type", "value"].includes(key))) {
      throw new BadRequestException("This ticket change is not supported.");
    }
    if (changeType === "work_note" && !isStaff(roles)) {
      return { error: "Only authorized support staff can add internal work notes." };
    }
    const incident = await this.incidentsService.findByCode(ticketNumber);
    await this.incidentsService.assertCanAccess(incident.incidentId, userId, roles);
    const value = change.value === undefined
      ? ""
      : maskPii(this.text(change.value, changeType === "contact_number" ? 20 : 2000, true));
    if (changeType !== "reopen" && changeType !== "contact_number" && !value) {
      return { error: "Ask the user what information or comment they want added." };
    }
    if (changeType === "reopen" && incident.status !== "Resolved") {
      throw new BadRequestException(incident.status === "Closed"
        ? "This incident is Closed and locked. Raise a Reopen request instead."
        : "Only a Resolved incident can be reopened.");
    }
    if (changeType !== "reopen" && ["Resolved", "Closed"].includes(incident.status)) {
      throw new BadRequestException(incident.status === "Closed"
        ? "This incident is Closed and locked. Raise a Reopen request instead."
        : `This incident is Resolved and locked. Reopen it to change ${changeType}.`);
    }
    const draft = {
      incidentId: incident.incidentId,
      ticketNumber: incident.incidentCode ?? incident.incidentId,
      changeType,
      value,
      status: incident.status,
    };
    const preview = {
      ticketNumber: draft.ticketNumber,
      title: incident.title,
      status: incident.status,
      changeType,
      value: changeType === "contact_number" ? "" : value,
      missingFields: changeType === "contact_number" ? ["New contact number"] : [],
    };
    const action = await this.saveDraft(sessionId, userId, "ticket_update", { draft, preview });
    return { actionId: action.id, kind: action.kind, preview, expiresAt: action.expiresAt };
  }

  private canUseAgentTools(roles: string[]) {
    return roles.some((role) => /^(admin|administrator|resolver|analyst|engineer|it agent)$/i.test(role.trim())
      || /\b(resolver|analyst|engineer|agent)\b/i.test(role));
  }

  private async staffIncident(ticketNumber: string, userId: number, roles: string[]) {
    if (!this.canUseAgentTools(roles)) throw new BadRequestException("Ticket summaries and suggested fixes are available to authorized support staff only.");
    const incident = await this.incidentsService.findByCode(ticketNumber.toUpperCase());
    if (!roles.some((role) => /^(admin|administrator)$/i.test(role.trim()))) {
      const workgroup = await this.incidentsService.findForWorkgroup(userId);
      if (!workgroup.some((item) => item.incidentId === incident.incidentId)) {
        throw new NotFoundException("Ticket not found in your authorized workgroups.");
      }
    }
    return incident;
  }

  private async summarizeTicket(ticketNumber: string, userId: number, roles: string[]) {
    const incident = await this.staffIncident(ticketNumber, userId, roles);
    const activity = await this.incidentsService.getActivity(incident.incidentId);
    return JSON.parse(maskPii(JSON.stringify({
      number: incident.incidentCode ?? incident.incidentId,
      title: incident.title,
      description: incident.description,
      status: incident.status,
      priority: incident.priority,
      timeline: activity.slice(-20).map((item) => ({
        at: item.createdAt,
        type: item.type,
        workNote: item.isWorkNote,
        content: item.content,
      })),
      workDone: activity.filter((item) => item.isWorkNote || item.type === "work_note").slice(-10).map((item) => item.content),
    })));
  }

  private async suggestFixes(ticketNumber: string, userId: number, roles: string[]) {
    const incident = await this.staffIncident(ticketNumber, userId, roles);
    const terms = [...new Set(`${incident.title} ${incident.description ?? ""}`.toLowerCase()
      .split(/[^a-z0-9]+/).filter((term) => term.length > 3))];
    const candidates = roles.some((role) => /^(admin|administrator)$/i.test(role.trim()))
      ? await this.incidentsService.findAll()
      : await this.incidentsService.findForWorkgroup(userId);
    const fixes = candidates
      .filter((item) => item.incidentId !== incident.incidentId && item.status === "Resolved")
      .map((item) => {
        const sameCategory = !!incident.category && item.category?.categoryId === incident.category.categoryId;
        const searchable = `${item.title} ${item.description ?? ""}`.toLowerCase();
        const matches = terms.filter((term) => searchable.includes(term)).length;
        return { item, score: matches + (sameCategory ? 3 : 0) };
      })
      .filter(({ item, score }) => score > 0 && !!item.resolutionNotes)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ item }) => ({
        number: item.incidentCode ?? item.incidentId,
        title: item.title,
        category: item.category?.categoryName ?? null,
        resolutionNotes: item.resolutionNotes,
      }));
    return JSON.parse(maskPii(JSON.stringify(fixes.length ? { suggestions: fixes } : { result: "No similar resolved incidents with recorded resolution notes were found." })));
  }

  private async handover(reason: string, chatSummary: string | undefined, userId: number, roles: string[]) {
    const summary = maskPii((chatSummary || reason).trim()).slice(0, 4000);
    const incident = await this.incidentsService.createHandoverIncident(userId, summary, roles);
    return {
      created: true,
      kind: "handover",
      number: incident.incidentCode ?? incident.incidentId,
      status: incident.status,
      assignmentGroup: incident.assignmentGroup?.groupName ?? "Service Desk",
    };
  }

  private async saveDraft(
    sessionId: string,
    userId: number,
    kind: ChatPendingActionKind,
    payload: Record<string, unknown>,
  ): Promise<ChatPendingAction> {
    const action = this.pendingActions.create({
      session: { sessionId } as ChatSession,
      userId,
      kind,
      payload: JSON.parse(maskPii(JSON.stringify(payload))) as Record<string, unknown>,
      expiresAt: new Date(Date.now() + 10 * 60_000),
      status: "pending",
    });
    return this.pendingActions.save(action);
  }

  async confirmAction(
    actionId: string,
    userId: number,
    sessionId: string,
    edits?: Record<string, unknown>,
    roles: string[] = [],
  ): Promise<ToolResult> {
    const action = await this.pendingActions.findOne({
      where: { id: actionId, userId, session: { sessionId } },
    });
    if (!action) throw new NotFoundException("Draft action not found.");
    if (action.status === "confirmed") {
      const result = action.payload.result;
      if (result && typeof result === "object") {
        const saved = result as Record<string, unknown>;
        if (typeof saved.error === "string") throw new BadRequestException(saved.error);
        return { alreadyConfirmed: true, ...saved };
      }
      throw new ConflictException("This draft has already been confirmed.");
    }
    if (action.status !== "pending") throw new ConflictException("This draft is no longer pending.");
    if (action.expiresAt.getTime() <= Date.now()) throw new BadRequestException("This draft expired. Ask the assistant to prepare it again.");

    const draft = this.mergeEdits(action, edits);
    await this.validateActionDraft(action, draft, roles);
    const storedDraft = JSON.parse(maskPii(JSON.stringify(draft))) as Record<string, unknown>;
    const claim = await this.pendingActions.createQueryBuilder()
      .update(ChatPendingAction)
      .set({ status: "confirmed", payload: { ...action.payload, draft: storedDraft } })
      .where('"id" = :id AND "user_id" = :userId AND "status" = :status AND "expires_at" > :now', {
        id: actionId,
        userId,
        status: "pending",
        now: new Date(),
      })
      .execute();
    if (claim.affected !== 1) {
      const current = await this.pendingActions.findOne({ where: { id: actionId, userId } });
      if (current?.status === "confirmed") {
        const result = current.payload.result;
        if (result && typeof result === "object") {
          const saved = result as Record<string, unknown>;
          if (typeof saved.error === "string") throw new BadRequestException(saved.error);
          return { alreadyConfirmed: true, ...saved };
        }
      }
      throw new ConflictException("This draft is no longer available to confirm.");
    }

    try {
      const result = await this.createFromDraft(action.kind, draft, userId, roles);
      const safeResult = JSON.parse(maskPii(JSON.stringify(result))) as Record<string, unknown>;
      await this.pendingActions.update({ id: actionId, userId }, {
        payload: { ...action.payload, draft: storedDraft, result: safeResult },
      });
      return safeResult;
    } catch (error) {
      await this.pendingActions.update({ id: actionId, userId }, {
        payload: { ...action.payload, draft: storedDraft, result: { error: error instanceof Error ? maskPii(error.message) : "The action could not be completed." } },
      });
      throw error;
    }
  }

  async cancelAction(actionId: string, userId: number, sessionId: string): Promise<{ cancelled: boolean }> {
    const result = await this.pendingActions.createQueryBuilder()
      .update(ChatPendingAction)
      .set({ status: "cancelled" })
      .where('"id" = :id AND "user_id" = :userId AND "session_id" = :sessionId AND "status" = :status', {
        id: actionId,
        userId,
        sessionId,
        status: "pending",
      })
      .execute();
    if (result.affected === 1) return { cancelled: true };
    const action = await this.pendingActions.findOne({ where: { id: actionId, userId, session: { sessionId } } });
    if (!action) throw new NotFoundException("Draft action not found.");
    if (action.status === "cancelled") return { cancelled: true };
    throw new ConflictException("This draft is no longer pending.");
  }

  async draftStatuses(userId: number, sessionId: string): Promise<Record<string, string>> {
    const actions = await this.pendingActions.find({ where: { userId, session: { sessionId } } });
    return Object.fromEntries(actions.map((action) => [
      action.id,
      action.status === "pending" && action.expiresAt.getTime() <= Date.now() ? "expired" : action.status,
    ]));
  }

  private mergeEdits(action: ChatPendingAction, edits?: Record<string, unknown>): Record<string, unknown> {
    const original = action.payload.draft as Record<string, unknown>;
    if (!edits || Object.keys(edits).length === 0) return original;
    if (action.kind === "incident") {
      const allowed = new Set(["title", "description", "categoryId", "subCategoryId", "classificationId", "impact", "urgency", "contactType"]);
      if (Object.keys(edits).some((key) => !allowed.has(key))) throw new BadRequestException("The incident draft contains unsupported edits.");
      return {
        ...original,
        ...edits,
        title: typeof edits.title === "string" ? maskPii(edits.title.trim()) : original.title,
        description: typeof edits.description === "string" ? maskPii(edits.description.trim()) : original.description,
      };
    }
    if (action.kind === "service_request") {
      if (Object.keys(edits).some((key) => key !== "variableValues") || !Array.isArray(edits.variableValues)) {
        throw new BadRequestException("The request draft contains unsupported edits.");
      }
      return { ...original, variableValues: edits.variableValues };
    }
    if (action.kind === "ticket_update") {
      if (Object.keys(edits).some((key) => key !== "value")) {
        throw new BadRequestException("The ticket update contains unsupported edits.");
      }
      const current = original.changeType === "contact_number"
        ? this.text(edits.value, 20)
        : maskPii(this.text(edits.value, 2000));
      return { ...original, value: current };
    }
    throw new BadRequestException("This draft type cannot be edited.");
  }

  private async validateActionDraft(action: ChatPendingAction, draft: Record<string, unknown>, roles: string[]): Promise<void> {
    if (action.kind === "incident") {
      const incident = draft as unknown as CreateIncidentDto;
      const title = this.text(incident.title, 200);
      const description = this.text(incident.description, 4000);
      if (incident.categoryId !== undefined && !Number.isInteger(incident.categoryId)) throw new BadRequestException("The selected category is invalid.");
      if (incident.subCategoryId !== undefined && !Number.isInteger(incident.subCategoryId)) throw new BadRequestException("The selected sub-category is invalid.");
      if (incident.classificationId !== undefined && !Number.isInteger(incident.classificationId)) throw new BadRequestException("The selected classification is invalid.");
      if (incident.impact !== undefined) this.text(incident.impact, 80);
      if (incident.urgency !== undefined) this.text(incident.urgency, 80);
      if (incident.categoryId !== undefined) {
        const category = await this.categories.findOne({
          where: { categoryId: incident.categoryId, isActive: true, allowInIncident: true },
        });
        if (!category) throw new BadRequestException("The selected incident category is no longer available.");
      }
      if (incident.subCategoryId !== undefined) {
        const subCategory = await this.subCategories.findOne({
          where: {
            subCategoryId: incident.subCategoryId,
            category: { categoryId: incident.categoryId },
            isActive: true,
          },
        });
        if (!subCategory) throw new BadRequestException("The selected sub-category is not available for this incident category.");
      }
      if (incident.impact !== undefined && !await this.impacts.findOne({ where: { impactName: ILike(incident.impact), isActive: true } })) {
        throw new BadRequestException("The selected impact is no longer available.");
      }
      if (incident.urgency !== undefined && !await this.urgencies.findOne({ where: { urgencyName: ILike(incident.urgency), isActive: true } })) {
        throw new BadRequestException("The selected urgency is no longer available.");
      }
      if (incident.classificationId !== undefined && !await this.classifications.findOne({
        where: { classificationId: incident.classificationId, isActive: true },
      })) {
        throw new BadRequestException("The selected classification is no longer available.");
      }
      if (incident.contactType !== undefined && !["Self-Service Portal", "Email", "Phone", "Chat"].includes(incident.contactType)) {
        throw new BadRequestException("The selected contact type is invalid.");
      }
      if (incident.impact && incident.urgency) {
        const derivedPriority = await this.incidentsService.suggestPriority(incident.impact, incident.urgency);
        if (derivedPriority) incident.priority = derivedPriority;
      }
      const validation = await this.incidentsService.validateChatDraft({ ...incident, title, description }, roles);
      if (validation.missingFields.length) throw new BadRequestException(`Please fill in the required fields: ${validation.missingFields.join(", ")}.`);
      return;
    }
    if (action.kind === "ticket_update") {
      const ticket = draft as { incidentId?: unknown; changeType?: unknown; value?: unknown; ticketNumber?: unknown };
      if (typeof ticket.incidentId !== "string" || typeof ticket.changeType !== "string") {
        throw new BadRequestException("The ticket update draft is invalid.");
      }
      const incident = await this.incidentsService.assertCanAccess(ticket.incidentId, action.userId, roles);
      if (ticket.changeType === "reopen") {
        if (incident.status !== "Resolved") throw new BadRequestException("Only a Resolved incident can be reopened.");
        return;
      }
      if (!["public_comment", "work_note", "information", "contact_number"].includes(ticket.changeType)) {
        throw new BadRequestException("This ticket change is not supported.");
      }
      if (ticket.changeType === "work_note" && !isStaff(roles)) {
        throw new BadRequestException("Only authorized support staff can add internal work notes.");
      }
      if (["Resolved", "Closed"].includes(incident.status)) {
        throw new BadRequestException(incident.status === "Closed"
          ? "This incident is Closed and locked. Raise a Reopen request instead."
          : `This incident is Resolved and locked. Reopen it to change ${ticket.changeType}.`);
      }
      if (typeof ticket.value !== "string" || !ticket.value.trim()) {
        throw new BadRequestException(ticket.changeType === "contact_number" ? "Enter the new contact number to confirm." : "A comment or information note is required.");
      }
      if (ticket.changeType === "contact_number" && !/^\+?[0-9][0-9 ()-]{5,18}$/.test(ticket.value.trim())) {
        throw new BadRequestException("Contact Number must be a valid phone number (digits, spaces, + ( ) - only; 6-20 characters).");
      }
      return;
    }
    if (action.kind === "service_request") {
      const request = draft as unknown as CreateRequestDto;
      if (!Number.isInteger(request.catalogId) || !Array.isArray(request.variableValues) || request.variableValues.length > 50) {
        throw new BadRequestException("The service request draft is invalid.");
      }
      for (const answer of request.variableValues) {
        if (!answer || !Number.isInteger(answer.variableId) || typeof answer.value !== "string" || answer.value.length > 2000) {
          throw new BadRequestException("A service request answer is invalid.");
        }
      }
      const validation = await this.requestsService.validateChatDraft(request.catalogId, request.variableValues);
      if (validation.missingFields.length) {
        throw new BadRequestException(`Please fill in the required fields: ${validation.missingFields.map((field) => field.label).join(", ")}.`);
      }
      return;
    }
    throw new BadRequestException("This draft type cannot be confirmed.");
  }

  private async createFromDraft(kind: ChatPendingActionKind, draft: Record<string, unknown>, userId: number, roles: string[]) {
    if (kind === "incident") {
      const incident = await this.incidentsService.create(userId, draft as unknown as CreateIncidentDto, roles);
      return {
        created: true,
        kind,
        number: incident.incidentCode ?? incident.incidentId,
        title: incident.title,
        status: incident.status,
      };
    }
    if (kind === "service_request") {
      const request = await this.requestsService.create(userId, draft as unknown as CreateRequestDto);
      return {
        created: true,
        kind,
        number: request.requestNumber,
        title: request.catalog?.catalogName ?? "Service request",
        status: request.status,
      };
    }
    if (kind === "ticket_update") {
      const update = draft as { incidentId: string; ticketNumber?: string; changeType: string; value?: string };
      if (update.changeType === "reopen") {
        const incident = await this.incidentsService.update(update.incidentId, { status: "Open" }, userId, roles);
        return { created: false, updated: true, reopened: true, kind, number: incident.incidentCode ?? incident.incidentId, status: incident.status };
      }
      if (update.changeType === "contact_number") {
        const contactNumber = typeof update.value === "string" ? update.value : "";
        const incident = await this.incidentsService.updateContactFromChat(update.incidentId, contactNumber, userId, roles);
        return { created: false, updated: true, kind, number: incident.incidentCode ?? incident.incidentId, status: incident.status };
      }
      const workNote = update.changeType === "work_note";
      if (workNote && !isStaff(roles)) throw new BadRequestException("Only authorized support staff can add internal work notes.");
      const activity = await this.incidentsService.addChatComment(update.incidentId, userId, update.value ?? "", workNote, roles);
      return { created: false, updated: true, kind, number: update.ticketNumber ?? update.incidentId, activityId: activity.activityId, status: "updated" };
    }
    throw new BadRequestException("This draft type cannot be created.");
  }

  private async searchCatalog(q: string) {
    if (!q) return { result: "Give a search phrase." };
    const like = `%${q.replace(/[%_]/g, "")}%`;
    const rows = await this.catalogs.find({
      where: [{ catalogName: ILike(like) }, { shortDescription: ILike(like) }, { description: ILike(like) }, { keywords: ILike(like) }]
        .map((where) => ({ ...where, isActive: true, status: "published" })),
      relations: { category: true },
      take: 5,
    });
    return rows.length
      ? rows.map((item) => ({ catalogId: item.catalogId, name: item.catalogName, description: item.shortDescription || item.description, category: item.category?.categoryName ?? null, approvalRequired: !!item.approvalRequired }))
      : { result: "Nothing in the catalog matches that." };
  }

  private async myTickets(userId: number, reference: string, roles: string[]) {
    const like = reference ? ILike(`%${reference.replace(/[%_]/g, "")}%`) : undefined;
    const [incs, reqs] = await Promise.all([
      this.incidents.find({
        where: [{ createdBy: { userId } }, { loggedBy: userId }].map((where) => (like ? { ...where, incidentCode: like } : where)) as any,
        relations: { assignmentGroup: true },
        order: { createdAt: "DESC" }, take: 5,
      }),
      this.requests.find({
        where: [{ requestedBy: { userId } }, { submittedBy: { userId } }].map((where) => (like ? { ...where, requestNumber: like } : where)) as any,
        relations: { catalog: true }, order: { createdAt: "DESC" }, take: 5,
      }),
    ]);
    const incidents = await Promise.all(incs.map(async (item) => {
      const activities = await this.incidentsService.getActivity(item.incidentId, { userId, roles });
      const publicComment = activities.filter((activity) => !activity.isWorkNote && activity.type === "comment").at(-1);
      const slaDue = [item.slaResponseTarget, item.slaResolutionTarget]
        .filter((target): target is Date => !!target)
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
      return {
        number: item.incidentCode ?? item.incidentId,
        summary: item.title,
        status: item.status,
        priority: item.priority,
        raised: item.createdAt,
        assigneeGroup: item.assignmentGroup?.groupName ?? null,
        lastUpdated: item.updatedAt,
        slaDue,
        lastPublicComment: publicComment?.content ?? null,
      };
    }));
    const out = {
      incidents,
      serviceRequests: reqs.map((item) => ({ number: item.requestNumber, item: item.catalog?.catalogName, status: item.status, raised: item.createdAt })),
    };
    return JSON.parse(maskPii(JSON.stringify(out)));
  }

  private async suggestTicketDetails(description: string, userId: number, roles: string[]) {
    const terms = [...new Set(description.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2))];
    const [categories, impacts, urgencies] = await Promise.all([
      this.categories.find({
        where: { isActive: true, allowInIncident: true },
        order: { displayOrder: "ASC", categoryId: "ASC" },
        take: 100,
      }),
      this.impacts.find({ where: { isActive: true }, order: { order: "ASC" } }),
      this.urgencies.find({ where: { isActive: true }, order: { order: "ASC" } }),
    ]);
    const category = categories
      .map((item) => ({
        item,
        score: terms.reduce((score, term) =>
          score + (term.length > 3 && `${item.categoryName} ${item.description ?? ""}`.toLowerCase().includes(term) ? 1 : 0), 0),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.displayOrder - b.item.displayOrder)[0]?.item;
    const subCategories = category
      ? await this.subCategories.find({
          where: { category: { categoryId: category.categoryId }, isActive: true },
          order: { subCategoryName: "ASC" },
        })
      : [];
    const subCategory = subCategories
      .map((item) => ({
        item,
        score: terms.reduce((score, term) =>
          score + (term.length > 3 && `${item.subCategoryName} ${item.description ?? ""}`.toLowerCase().includes(term) ? 1 : 0), 0),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.item;
    const subCategoryOptions = await this.subCategories.find({
      where: { isActive: true },
      relations: { category: true },
      order: { subCategoryName: "ASC" },
    });
    const impact = impacts.find((item) => /many users|everyone|company-wide|global|system down|outage/i.test(description))
      ?? impacts.find((item) => /medium/i.test(item.impactName))
      ?? impacts[0];
    const urgency = urgencies.find((item) => /cannot work|blocked|urgent|immediately|down|outage|locked out|cannot sign in|cannot log in/i.test(description))
      ?? urgencies.find((item) => /medium/i.test(item.urgencyName))
      ?? urgencies[0];
    const priority = impact && urgency
      ? await this.incidentsService.suggestPriority(impact.impactName, urgency.urgencyName)
      : null;
    const history = isStaff(roles)
      ? await this.incidentsService.findForWorkgroup(userId)
      : (await this.incidentsService.findAllForUser(userId))
        .filter((item) => item.createdBy?.userId === userId || item.loggedBy === userId);
    const similarIncidents = history
      .map((item) => {
        const searchable = `${item.title} ${item.description ?? ""} ${item.category?.categoryName ?? ""}`.toLowerCase();
        const score = terms.reduce((count, term) => count + (searchable.includes(term) ? 1 : 0), 0)
          + (category && item.category?.categoryId === category.categoryId ? 2 : 0);
        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ item }) => ({
        number: item.incidentCode ?? item.incidentId,
        title: item.title,
        status: item.status,
        resolutionNotes: item.status === "Resolved" ? item.resolutionNotes ?? null : null,
      }));
    return JSON.parse(maskPii(JSON.stringify({
      category: category ? { id: category.categoryId, name: category.categoryName } : null,
      subCategory: subCategory ? { id: subCategory.subCategoryId, name: subCategory.subCategoryName } : null,
      impact: impact ? { id: impact.impactId, name: impact.impactName } : null,
      urgency: urgency ? { id: urgency.urgencyId, name: urgency.urgencyName } : null,
      priority,
      similarIncidents,
      categoryOptions: categories.map((item) => ({ id: item.categoryId, name: item.categoryName })),
      subCategoryOptions: subCategoryOptions
        .filter((item) => item.category && categories.some((candidate) => candidate.categoryId === item.category?.categoryId))
        .map((item) => ({ id: item.subCategoryId, name: item.subCategoryName, categoryId: item.category?.categoryId })),
      impactOptions: impacts.map((item) => item.impactName),
      urgencyOptions: urgencies.map((item) => item.urgencyName),
    })));
  }
}
