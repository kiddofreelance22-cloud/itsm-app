import { NotFoundException } from "@nestjs/common";
import { ChatToolsService, TOOL_DEFS } from "./chat-tools.service";

describe("ChatToolsService", () => {
  const incidentsService = {
    validateChatDraft: jest.fn(),
    suggestPriority: jest.fn(),
    create: jest.fn(),
    findByCode: jest.fn(),
    assertCanAccess: jest.fn(),
    addChatComment: jest.fn(),
    update: jest.fn(),
    updateContactFromChat: jest.fn(),
    createHandoverIncident: jest.fn(),
    findAllForUser: jest.fn().mockResolvedValue([]),
    findForWorkgroup: jest.fn().mockResolvedValue([]),
  };
  const requestsService = {
    validateChatDraft: jest.fn(),
    create: jest.fn(),
  };
  const categoriesRepository = { find: jest.fn(), findOne: jest.fn() };
  const classificationsRepository = { find: jest.fn(), findOne: jest.fn() };
  const impactsRepository = { find: jest.fn(), findOne: jest.fn() };
  const urgenciesRepository = { find: jest.fn(), findOne: jest.fn() };
  const prioritiesRepository = { find: jest.fn() };
  const actions = new Map<string, any>();
  const pendingActions: any = {
    create: jest.fn((action) => ({ id: "action-1", ...action })),
    save: jest.fn(async (action) => {
      actions.set(action.id, action);
      return action;
    }),
    findOne: jest.fn(async ({ where }) => {
      const action = actions.get(where.id);
      if (!action || action.userId !== where.userId
        || (where.session && action.session.sessionId !== where.session.sessionId)) return null;
      return action;
    }),
    update: jest.fn(async (where, values) => {
      const action = actions.get(where.id);
      if (action) Object.assign(action, values);
      return { affected: action ? 1 : 0 };
    }),
    createQueryBuilder: jest.fn(() => {
      let updates: any;
      let conditions: any;
      const builder: any = {
        update() { return this; },
        set(value: any) { updates = value; return this; },
        where(_sql: string, value: any) { conditions = value; return this; },
        async execute() {
          const action = actions.get(conditions.id);
          if (!action || action.userId !== conditions.userId || action.status !== conditions.status
            || (conditions.sessionId && action.session.sessionId !== conditions.sessionId)
            || (conditions.now && action.expiresAt <= conditions.now)) return { affected: 0 };
          Object.assign(action, updates);
          return { affected: 1 };
        },
      };
      return builder;
    }),
  };
  let tools: ChatToolsService;

  beforeEach(() => {
    actions.clear();
    jest.clearAllMocks();
    incidentsService.validateChatDraft.mockResolvedValue({ missingFields: [] });
    incidentsService.suggestPriority.mockResolvedValue("High");
    incidentsService.findByCode.mockResolvedValue({
      incidentId: "incident-1",
      incidentCode: "INC-123",
      title: "Cannot sign in",
      status: "Open",
      createdBy: { userId: 42 },
      loggedBy: 42,
    });
    incidentsService.assertCanAccess.mockImplementation(async (id: string) => ({
      incidentId: id,
      incidentCode: "INC-123",
      title: "Cannot sign in",
      status: "Open",
      createdBy: { userId: 42 },
      loggedBy: 42,
    }));
    incidentsService.addChatComment.mockResolvedValue({ activityId: 5 });
    incidentsService.update.mockResolvedValue({ incidentId: "incident-1", incidentCode: "INC-123", status: "Open" });
    incidentsService.updateContactFromChat.mockResolvedValue({ incidentId: "incident-1", incidentCode: "INC-123", status: "Open" });
    incidentsService.create.mockResolvedValue({
      incidentId: "INC123",
      incidentCode: "INC123",
      title: "Cannot sign in",
      status: "Open",
    });
    requestsService.validateChatDraft.mockResolvedValue({
      catalog: { catalogId: 3, name: "Laptop" },
      variables: [],
      missingFields: [],
      preview: { approvals: [] },
    });
    requestsService.create.mockResolvedValue({ requestNumber: "REQ-1", status: "Pending Approval", catalog: { catalogName: "Laptop" } });
    categoriesRepository.find.mockResolvedValue([]);
    categoriesRepository.findOne.mockResolvedValue(null);
    classificationsRepository.find.mockResolvedValue([]);
    classificationsRepository.findOne.mockResolvedValue(null);
    impactsRepository.find.mockResolvedValue([]);
    impactsRepository.findOne.mockResolvedValue(null);
    urgenciesRepository.find.mockResolvedValue([]);
    urgenciesRepository.findOne.mockResolvedValue(null);
    prioritiesRepository.find.mockResolvedValue([]);
    tools = new ChatToolsService(
      { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() } as any,
      {} as any,
      {} as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      categoriesRepository as any,
      classificationsRepository as any,
      { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() } as any,
      impactsRepository as any,
      urgenciesRepository as any,
      prioritiesRepository as any,
      pendingActions,
      { search: jest.fn() } as any,
      incidentsService as any,
      requestsService as any,
    );
  });

  it("offers only read-only and draft tools to the model", () => {
    expect(TOOL_DEFS.map(({ name }) => name)).toEqual([
      "search_knowledge",
      "search_catalog",
      "get_my_tickets",
      "suggest_ticket_details",
      "draft_incident",
      "draft_service_request",
      "draft_ticket_update",
      "summarize_ticket",
      "suggest_fixes",
      "handover_to_service_desk",
    ]);
  });

  it("stores an incident draft without creating a ticket", async () => {
    const result = await tools.run("draft_incident", {
      title: "Cannot sign in",
      description: "The login page rejects my password.",
    }, 42, "session-1");

    expect(result).toEqual(expect.objectContaining({ actionId: "action-1", kind: "incident" }));
    expect(incidentsService.create).not.toHaveBeenCalled();
    expect(actions.get("action-1").userId).toBe(42);
  });

  it("uses active incident options and the priority rule to populate the draft", async () => {
    const category = { categoryId: 11, categoryName: "Login Access", isActive: true, allowInIncident: true };
    const classification = { classificationId: 7, name: "Account Access", isActive: true };
    const impact = { impactId: 1, impactName: "Medium", isActive: true, order: 1 };
    const urgency = { urgencyId: 1, urgencyName: "Medium", isActive: true, order: 1 };
    categoriesRepository.find.mockResolvedValue([category]);
    categoriesRepository.findOne.mockResolvedValue(category);
    classificationsRepository.find.mockResolvedValue([classification]);
    classificationsRepository.findOne.mockResolvedValue(classification);
    impactsRepository.find.mockResolvedValue([impact]);
    impactsRepository.findOne.mockResolvedValue(impact);
    urgenciesRepository.find.mockResolvedValue([urgency]);
    urgenciesRepository.findOne.mockResolvedValue(urgency);

    await tools.run("draft_incident", {
      title: "Cannot sign in",
      description: "The login page rejects my password.",
      classification: "Account Access",
    }, 42, "session-1");

    expect(actions.get("action-1").payload.draft).toMatchObject({
      categoryId: 11,
      classificationId: 7,
      impact: "Medium",
      urgency: "Medium",
      priority: "High",
      contactType: "Self-Service Portal",
    });
    expect(incidentsService.validateChatDraft).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 11, classificationId: 7, impact: "Medium", urgency: "Medium", priority: "High", contactType: "Self-Service Portal" }),
      [],
    );
  });

  it("requires the signed-in user and action confirmation to create an incident", async () => {
    await tools.run("draft_incident", {
      title: "Cannot sign in",
      description: "The login page rejects my password.",
    }, 42, "session-1");

    await tools.confirmAction("action-1", 42, "session-1");

    expect(incidentsService.create).toHaveBeenCalledTimes(1);
    expect(incidentsService.create).toHaveBeenCalledWith(42, {
      title: "Cannot sign in",
      description: "The login page rejects my password.",
      priority: "Medium",
      contactType: "Self-Service Portal",
    }, []);
  });

  it("does not create twice when the same draft is confirmed twice", async () => {
    await tools.run("draft_incident", {
      title: "Cannot sign in",
      description: "The login page rejects my password.",
    }, 42, "session-1");

    await tools.confirmAction("action-1", 42, "session-1");
    const repeated = await tools.confirmAction("action-1", 42, "session-1");

    expect(incidentsService.create).toHaveBeenCalledTimes(1);
    expect(repeated).toEqual(expect.objectContaining({ alreadyConfirmed: true, number: "INC123" }));
  });

  it("rejects expired drafts without creating an incident", async () => {
    await tools.run("draft_incident", {
      title: "Cannot sign in",
      description: "The login page rejects my password.",
    }, 42, "session-1");
    actions.get("action-1").expiresAt = new Date(Date.now() - 1);

    await expect(tools.confirmAction("action-1", 42, "session-1")).rejects.toThrow(/expired/i);
    expect(incidentsService.create).not.toHaveBeenCalled();
  });

  it("does not reveal or confirm another user's draft", async () => {
    await tools.run("draft_incident", {
      title: "Cannot sign in",
      description: "The login page rejects my password.",
    }, 42, "session-1");

    await expect(tools.confirmAction("action-1", 7, "session-1")).rejects.toThrow(NotFoundException);
    expect(incidentsService.create).not.toHaveBeenCalled();
  });

  it("rejects missing required fields before confirmation", async () => {
    incidentsService.validateChatDraft.mockResolvedValue({ missingFields: ["Description"] });
    await tools.run("draft_incident", { title: "Cannot sign in", description: "" }, 42, "session-1");

    await expect(tools.confirmAction("action-1", 42, "session-1")).rejects.toThrow(/required tool field/i);
    expect(incidentsService.create).not.toHaveBeenCalled();
  });

  it("creates a ticket update draft without changing the incident", async () => {
    const result = await tools.run("draft_ticket_update", {
      ticketNumber: "INC-123",
      change: { type: "public_comment", value: "I can reproduce this." },
    }, 42, "session-1");

    expect(result).toEqual(expect.objectContaining({ actionId: "action-1", kind: "ticket_update" }));
    expect(incidentsService.addChatComment).not.toHaveBeenCalled();
  });

  it("applies a ticket update only after confirmation", async () => {
    await tools.run("draft_ticket_update", {
      ticketNumber: "INC-123",
      change: { type: "public_comment", value: "I can reproduce this." },
    }, 42, "session-1");
    await tools.confirmAction("action-1", 42, "session-1");

    expect(incidentsService.addChatComment).toHaveBeenCalledWith(
      "incident-1", 42, "I can reproduce this.", false, [],
    );
  });

  it("rejects updates to locked Resolved incidents", async () => {
    incidentsService.findByCode.mockResolvedValue({
      incidentId: "incident-1", incidentCode: "INC-123", title: "Cannot sign in", status: "Resolved",
    });
    incidentsService.assertCanAccess.mockResolvedValue({
      incidentId: "incident-1", incidentCode: "INC-123", title: "Cannot sign in", status: "Resolved",
    });

    await expect(tools.run("draft_ticket_update", {
      ticketNumber: "INC-123",
      change: { type: "public_comment", value: "New information." },
    }, 42, "session-1")).rejects.toThrow(/Resolved and locked/i);
    expect(incidentsService.addChatComment).not.toHaveBeenCalled();
  });

  it("does not persist a contact number entered at confirmation", async () => {
    await tools.run("draft_ticket_update", {
      ticketNumber: "INC-123",
      change: { type: "contact_number" },
    }, 42, "session-1");
    await tools.confirmAction("action-1", 42, "session-1", { value: "415-555-2671" });

    expect(incidentsService.updateContactFromChat).toHaveBeenCalledWith("incident-1", "415-555-2671", 42, []);
    expect(JSON.stringify(actions.get("action-1").payload)).not.toContain("415-555-2671");
  });

  it("refuses agent-assist tools to end users", async () => {
    await expect(tools.run("summarize_ticket", { ticketNumber: "INC-123" }, 42, "session-1", []))
      .rejects.toThrow(/support staff only/i);
  });

  it("creates a Service Desk handover as the signed-in user", async () => {
    incidentsService.createHandoverIncident.mockResolvedValue({
      incidentCode: "INC-HANDOVER-1",
      status: "Open",
      assignmentGroup: { groupName: "Service Desk" },
    });

    const result = await tools.run("handover_to_service_desk", { reason: "I need a person." }, 42, "session-1", [], {
      chatSummary: "user: I need a person.",
    });

    expect(incidentsService.createHandoverIncident).toHaveBeenCalledWith(42, "user: I need a person.", []);
    expect(result).toEqual(expect.objectContaining({ created: true, number: "INC-HANDOVER-1" }));
  });
});
