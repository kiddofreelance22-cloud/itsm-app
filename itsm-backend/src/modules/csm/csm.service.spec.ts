import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { MailService } from "../mail/mail.service";
import { CsmService } from "./csm.service";

describe("CsmService", () => {
  const serviceWithQuery = (query: jest.Mock) =>
    new CsmService({ query } as unknown as DataSource, { queue: jest.fn() });

  it("resolves the mail dependency using its explicit Nest provider token", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CsmService,
        { provide: DataSource, useValue: { query: jest.fn() } },
        { provide: MailService, useValue: { queue: jest.fn() } },
      ],
    }).compile();

    expect(moduleRef.get(CsmService)).toBeInstanceOf(CsmService);
    await moduleRef.close();
  });

  it("parameterizes case search and combines filters without interpolating user input", async () => {
    const query = jest.fn().mockResolvedValue([]);
    await serviceWithQuery(query).listCases({
      q: "vpn' OR 1=1 --",
      status: "Open",
      priority: "High",
      customerType: "B2B",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("(c.case_code ILIKE $1 OR c.short_description ILIKE $1 OR cu.name ILIKE $1)"),
      ["%vpn' OR 1=1 --%", "Open", "High", "B2B"],
    );
    expect(query.mock.calls[0][0]).toContain("c.status = $2 AND c.priority = $3 AND cu.customer_type = $4");
  });

  it("only applies a saved view visible to its owner or staff-shared users", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ filters: { status: "Open" } }])
      .mockResolvedValueOnce([]);

    await serviceWithQuery(query).listCases({ viewId: 7, userId: 4 });

    expect(query.mock.calls[0]).toEqual([
      expect.stringContaining("is_shared = true OR created_by = $2"),
      [7, 4],
    ]);
    expect(query.mock.calls[1][0]).toContain("c.status = $1");
    expect(query.mock.calls[1][1]).toEqual(["Open"]);
  });

  it("rejects a case when the selected customer is not active", async () => {
    const query = jest.fn().mockResolvedValue([]);
    const svc = serviceWithQuery(query);

    await expect(svc.createCase(1, {
      customerId: 99,
      caseType: "Issue",
      category: "Network",
      shortDescription: "Cannot connect",
      description: "Internet is unavailable.",
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("queues escalation email to the selected customer, owner, group, and explicit recipients", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ case_id: 8 }])
      .mockResolvedValueOnce([{ escalationId: 3 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ escalationId: 3 }])
      .mockResolvedValueOnce([{
        caseCode: "CSE000008", shortDescription: "<database issue>", contactEmail: "contact@example.com",
        customerEmail: "account@example.com", assignedEmail: "owner@example.com", groupId: 2,
      }])
      .mockResolvedValueOnce([{ email: "agent@example.com" }]);
    const mail = { queue: jest.fn().mockResolvedValue(undefined) };
    const service = new CsmService({ query } as unknown as DataSource, mail);

    await service.createEscalation(1, {
      caseId: 8, escalationType: "SLA Breach", level: "Level 2", priority: "High",
      dueBy: new Date(Date.now() + 60_000).toISOString(), reason: "Customer is blocked.",
      recipients: ["Customer", "Case Owner", "Support Group", "observer@example.com"],
      sendImmediateNotification: true,
    });

    expect(mail.queue).toHaveBeenCalledWith(expect.objectContaining({
      to: expect.arrayContaining(["contact@example.com", "owner@example.com", "observer@example.com", "agent@example.com"]),
      html: expect.stringContaining("&lt;database issue&gt;"),
    }));
  });

  it("does not queue escalation email when immediate notification is disabled", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ case_id: 8 }])
      .mockResolvedValueOnce([{ escalationId: 3 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ escalationId: 3 }]);
    const mail = { queue: jest.fn() };
    const service = new CsmService({ query } as unknown as DataSource, mail);

    await service.createEscalation(1, {
      caseId: 8, escalationType: "Priority", level: "Level 1", priority: "Medium",
      dueBy: new Date(Date.now() + 60_000).toISOString(), reason: "Needs triage.",
      sendImmediateNotification: false,
    });

    expect(mail.queue).not.toHaveBeenCalled();
  });
});
