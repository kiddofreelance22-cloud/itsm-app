import { ChatService } from "./chat.service";

const cfg = (vals: Record<string, string>) => ({ get: (k: string) => vals[k] }) as any;

function build(opts: { key?: string; timeout?: string; baseUrl?: string; model?: string } = {}) {
  const saved: any[] = [];
  const sessions = {
    save: jest.fn(async (s: any) => ({ sessionId: "11111111-1111-4111-8111-111111111111", ...s })),
    create: (s: any) => s,
    findOne: jest.fn(),
  };
  const messages = {
    find: jest.fn(async () => []),
    create: (m: any) => m,
    save: jest.fn(async (m: any) => { saved.push(m); return { messageId: "22222222-2222-4222-8222-222222222222", ...m }; }),
    findOne: jest.fn(),
  };
  const tools = { run: jest.fn(async () => ({ incidents: [{ number: "INC1", status: "In Progress" }] })) };
  const svc = new ChatService(cfg({
    ...(opts.key === undefined ? { OPENAI_API_KEY: "k" } : opts.key ? { OPENAI_API_KEY: opts.key } : {}),
    ...(opts.timeout ? { CHAT_TIMEOUT_MS: opts.timeout } : {}),
    ...(opts.baseUrl ? { OPENAI_BASE_URL: opts.baseUrl } : {}),
    ...(opts.model ? { CHAT_MODEL: opts.model } : {}),
  }), tools as any, sessions as any, messages as any);
  return { svc, saved, tools, messages };
}

describe("ChatService", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the local Ollama default without requiring an API key", async () => {
    const { svc } = build({ key: "" });
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true, json: async () => ({ choices: [{ message: { role: "assistant", content: "Hello" } }] }),
    } as any);

    await svc.send(1, "Can you help me?");

    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:11434/v1/chat/completions");
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer ollama");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("qwen2.5:3b");
  });

  it("requires a key when configured to use a remote model endpoint", async () => {
    const { svc } = build({ key: "", baseUrl: "https://api.example.com/v1" });
    await expect(svc.send(1, "hi")).rejects.toThrow(/not configured/i);
  });

  it("masks personal data before it reaches the model and the audit log", async () => {
    const { svc, saved } = build();
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { role: "assistant", content: "Hello" } }] }) } as any);
    await svc.send(1, "my email is asha@meridian.com");
    const sent = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(JSON.stringify(sent.messages)).not.toContain("asha@meridian.com");
    expect(saved[0].content).toBe("my email is [email]");
  });

  it("uses the configured model request timeout", async () => {
    const { svc } = build({ timeout: "180000" });
    const timeoutSpy = jest.spyOn(AbortSignal, "timeout").mockReturnValue(new AbortController().signal);
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { role: "assistant", content: "Hello" } }] }) } as any);

    await svc.send(1, "Can you explain our IT policy?");

    expect(timeoutSpy).toHaveBeenCalledWith(180000);
    const requestBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(requestBody.max_tokens).toBe(1024);
    expect(requestBody.max_completion_tokens).toBeUndefined();
  });

  it("runs a requested tool as the signed-in user and returns the final answer", async () => {
    const { svc, tools, saved } = build();
    const fetchMock = jest.spyOn(global, "fetch" as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "t1", type: "function", function: { name: "get_my_tickets", arguments: "{}" } }] } }] }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { role: "assistant", content: "INC1 is In Progress." } }] }) } as any);
    const out = await svc.send(42, "where is my incident?");
    expect(tools.run).toHaveBeenCalledWith(
      "get_my_tickets", {}, 42, "11111111-1111-4111-8111-111111111111", [],
      { chatSummary: "user: where is my incident?" },
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(out.reply).toBe("INC1 is In Progress.");
    expect(saved.at(-1).toolCalls).toEqual([{
      name: "get_my_tickets",
      input: {},
      resultSummary: { incidents: [{ number: "INC1", status: "In Progress" }] },
    }]);
  });

  it("does not leak a conversation to a different user", async () => {
    const { svc } = build();
    (svc as any).sessions.findOne.mockResolvedValue({ sessionId: "s", userId: 7 });
    await expect(svc.send(1, "hi", "33333333-3333-4333-8333-333333333333")).rejects.toThrow(/not found/i);
  });

  it("handles greetings without calling the model", async () => {
    const { svc, tools } = build();
    const fetchMock = jest.spyOn(global, "fetch" as any);

    const result = await svc.send(1, "hello");

    expect(result.reply).toMatch(/how can i help/i);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(tools.run).not.toHaveBeenCalled();
  });

  it("searches the local knowledge base directly for how-to questions", async () => {
    const { svc, tools } = build();
    tools.run.mockResolvedValueOnce([{ source: "VPN Guide", text: "Open the VPN client and select Connect." }]);
    const fetchMock = jest.spyOn(global, "fetch" as any);

    const result = await svc.send(42, "How do I connect to VPN?");

    expect(tools.run).toHaveBeenCalledWith(
      "search_knowledge", { query: "How do I connect to VPN?" }, 42, "11111111-1111-4111-8111-111111111111", [],
    );
    expect(result.reply).toContain("Open the VPN client");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("automatically hands explicit human requests to the Service Desk", async () => {
    const { svc, tools } = build();
    tools.run.mockResolvedValueOnce({ created: true, number: "INC-HANDOVER-1" } as any);
    const fetchMock = jest.spyOn(global, "fetch" as any);

    const result = await svc.send(42, "agent");

    expect(tools.run).toHaveBeenCalledWith(
      "handover_to_service_desk",
      { reason: "agent" },
      42,
      "11111111-1111-4111-8111-111111111111",
      [],
      expect.objectContaining({ chatSummary: "user: agent" }),
    );
    expect(result.reply).toContain("INC-HANDOVER-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prepares an incident draft for an explicit create-incident request without relying on model tool selection", async () => {
    const { svc, tools } = build();
    tools.run
      .mockResolvedValueOnce({ category: null })
      .mockResolvedValueOnce({ actionId: "draft-1", kind: "incident", preview: {}, expiresAt: "2030-01-01T00:00:00.000Z" });
    const fetchMock = jest.spyOn(global, "fetch" as any);

    const result = await svc.send(42, "Please create an incident about my VPN not working.");

    expect(tools.run).toHaveBeenNthCalledWith(1, "suggest_ticket_details", { description: "Please create an incident about my VPN not working." }, 42, "11111111-1111-4111-8111-111111111111", []);
    expect(tools.run).toHaveBeenNthCalledWith(2, "draft_incident", expect.objectContaining({ title: "my VPN not working" }), 42, "11111111-1111-4111-8111-111111111111", []);
    expect(result.draftActions).toEqual([expect.objectContaining({ actionId: "draft-1" })]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("summarizes an incident number directly without relying on model tool selection", async () => {
    const { svc, tools } = build();
    tools.run.mockResolvedValueOnce({
      number: "INC030", title: "VPN unavailable", status: "In Progress", priority: "High",
      description: "The VPN client will not connect.", workDone: ["Reinstalled VPN client."], timeline: [],
    });
    const fetchMock = jest.spyOn(global, "fetch" as any);

    const result = await svc.send(42, "Summarize ticket INC030", undefined, ["Analyst"]);

    expect(tools.run).toHaveBeenCalledWith(
      "summarize_ticket", { ticketNumber: "INC030" }, 42, "11111111-1111-4111-8111-111111111111", ["Analyst"],
      { chatSummary: "user: Summarize ticket INC030" },
    );
    expect(result.reply).toContain("INC030 — VPN unavailable");
    expect(result.reply).toContain("Reinstalled VPN client.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains an incident number directly for an admin", async () => {
    const { svc, tools } = build();
    tools.run.mockResolvedValueOnce({
      number: "INCI021", title: "Email unavailable", status: "In Progress", priority: "High",
      description: "Email is not loading.", workDone: [], timeline: [],
    });
    const fetchMock = jest.spyOn(global, "fetch" as any);

    const result = await svc.send(42, "explain me incident INCI021", undefined, ["Admin"]);

    expect(tools.run).toHaveBeenCalledWith(
      "summarize_ticket", { ticketNumber: "INCI021" }, 42, "11111111-1111-4111-8111-111111111111", ["Admin"],
      { chatSummary: "user: explain me incident INCI021" },
    );
    expect(result.reply).toContain("INCI021 — Email unavailable");
    expect(result.reply).toContain("Description: Email is not loading.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("finds authorized recorded fixes directly for an explicit incident request", async () => {
    const { svc, tools } = build();
    tools.run.mockResolvedValueOnce({ suggestions: [{ number: "INC029", title: "VPN disconnects", resolutionNotes: "Reinstalled the client." }] });
    const fetchMock = jest.spyOn(global, "fetch" as any);

    const result = await svc.send(42, "Suggest fixes for INC030", undefined, ["Analyst"]);

    expect(tools.run).toHaveBeenCalledWith(
      "suggest_fixes", { ticketNumber: "INC030" }, 42, "11111111-1111-4111-8111-111111111111", ["Analyst"],
      { chatSummary: "user: Suggest fixes for INC030" },
    );
    expect(result.reply).toContain("INC029 — VPN disconnects");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("finds the requested catalog item and prepares a service-request draft", async () => {
    const { svc, tools } = build();
    tools.run
      .mockResolvedValueOnce([{ catalogId: 12, name: "Laptop", description: "Standard laptop" }])
      .mockResolvedValueOnce({ actionId: "request-draft-1", kind: "service_request", preview: { catalogName: "Laptop" } });
    const fetchMock = jest.spyOn(global, "fetch" as any);

    const result = await svc.send(42, "I need a laptop");

    expect(tools.run).toHaveBeenNthCalledWith(1, "search_catalog", { query: "laptop" }, 42, "11111111-1111-4111-8111-111111111111", []);
    expect(tools.run).toHaveBeenNthCalledWith(2, "draft_service_request", { catalogItem: "Laptop", answers: [] }, 42, "11111111-1111-4111-8111-111111111111", [], { chatSummary: "user: I need a laptop" });
    expect(result.draftActions).toEqual([expect.objectContaining({ actionId: "request-draft-1" })]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses a catalog selection from the previous chat turn to prepare a request", async () => {
    const { svc, tools, messages } = build();
    (svc as any).sessions.findOne.mockResolvedValue({ sessionId: "11111111-1111-4111-8111-111111111111", userId: 42 });
    messages.find.mockResolvedValueOnce([
      { role: "assistant", content: "Please reply with a catalog item name from this list: Standard Laptop, MacBook" },
      { role: "user", content: "I need a laptop" },
    ]);
    tools.run
      .mockResolvedValueOnce([{ catalogId: 12, name: "Standard Laptop" }, { catalogId: 13, name: "MacBook" }])
      .mockResolvedValueOnce({ actionId: "request-draft-2", kind: "service_request", preview: { catalogName: "Standard Laptop" } });
    const fetchMock = jest.spyOn(global, "fetch" as any);

    const result = await svc.send(42, "Standard Laptop", "11111111-1111-4111-8111-111111111111");

    expect(tools.run).toHaveBeenNthCalledWith(2, "draft_service_request", { catalogItem: "Standard Laptop", answers: [] }, 42, "11111111-1111-4111-8111-111111111111", [], expect.any(Object));
    expect(result.draftActions).toEqual([expect.objectContaining({ actionId: "request-draft-2" })]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prepares ticket updates for confirmation without relying on model tool selection", async () => {
    const { svc, tools } = build();
    tools.run.mockResolvedValueOnce({
      actionId: "update-draft-1", kind: "ticket_update", preview: { ticketNumber: "INC030", changeType: "public_comment" },
    });
    const fetchMock = jest.spyOn(global, "fetch" as any);

    const result = await svc.send(42, "Add a comment to INC030: VPN still disconnects.");

    expect(tools.run).toHaveBeenCalledWith(
      "draft_ticket_update",
      { ticketNumber: "INC030", change: { type: "public_comment", value: "VPN still disconnects." } },
      42, "11111111-1111-4111-8111-111111111111", [], { chatSummary: "user: Add a comment to INC030: VPN still disconnects." },
    );
    expect(result.draftActions).toEqual([expect.objectContaining({ actionId: "update-draft-1" })]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("replaces unconfirmed ticket-creation claims", async () => {
    const { svc } = build();
    jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { role: "assistant", content: "I created your ticket." } }] }),
    } as any);

    const result = await svc.send(1, "Please take care of my request.");

    expect(result.reply).toMatch(/draft.*not been submitted/i);
  });
});
