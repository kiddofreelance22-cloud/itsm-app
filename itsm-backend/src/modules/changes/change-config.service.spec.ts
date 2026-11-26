import { DataSource, Repository } from "typeorm";
import { ChangeSetting } from "./entities/change-setting.entity";
import { ChangeConfigService } from "./change-config.service";
import { ModelStateTransitions } from "./change-config";

const setup: ModelStateTransitions = {
  model: "Configured model",
  states: [
    { state: "New", inUse: true, purpose: "", movedOnBy: "Change owner", requirements: [], canCancel: true },
    { state: "Assess", inUse: false, purpose: "", movedOnBy: "Change manager", requirements: [], canCancel: true },
    { state: "Authorize", inUse: true, purpose: "", movedOnBy: "Approval groups", requirements: [], canCancel: true },
    { state: "Scheduled", inUse: true, purpose: "", movedOnBy: "Change owner", requirements: [], canCancel: true },
    { state: "Implement", inUse: true, purpose: "", movedOnBy: "Assignment group", requirements: [], canCancel: false },
    { state: "Review", inUse: true, purpose: "", movedOnBy: "Change manager", requirements: [], canCancel: false },
    { state: "Closed", inUse: true, purpose: "", movedOnBy: "System (automatic)", requirements: [], canCancel: false },
  ],
  automatic: { approvalToScheduled: false, implementAtPlannedStart: false, blockBlackout: false, closeAfterReviewDays: 0, overrunReminderMinutes: 0 },
};

describe("state transition settings", () => {
  const makeService = () => {
    const stored: ChangeSetting[] = [];
    const repository = {
      find: jest.fn().mockImplementation(() => Promise.resolve(stored)),
      create: jest.fn((value) => value),
      save: jest.fn((value: ChangeSetting) => {
        const index = stored.findIndex((item) => item.key === value.key);
        if (index >= 0) stored[index] = value;
        else stored.push(value);
        return Promise.resolve(value);
      }),
    } as unknown as Repository<ChangeSetting>;
    const dataSource = { query: jest.fn().mockResolvedValue([]) } as unknown as DataSource;
    return { service: new ChangeConfigService(repository, dataSource), repository };
  };

  it("persists a valid per-model state configuration", async () => {
    const { service, repository } = makeService();
    await service.save("stateTransitions", [setup]);
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ key: "stateTransitions", value: [setup] }));
  });

  it("rejects duplicate states and invalid automatic-transition limits", async () => {
    const { service } = makeService();
    const duplicate = { ...setup, states: [...setup.states.slice(0, 6), setup.states[0]] };
    await expect(service.save("stateTransitions", [duplicate])).rejects.toThrow("configure each lifecycle state exactly once");
    await expect(service.save("stateTransitions", [{ ...setup, automatic: { ...setup.automatic, closeAfterReviewDays: 366 } }]))
      .rejects.toThrow("between 0 and 365 business days");
  });

  it("assigns a suitable existing lifecycle when saving a legacy model with no lifecycle", async () => {
    const { service, repository } = makeService();
    await service.save("lifecycles", [
      { id: "normal-lc", name: "Normal lifecycle", desc: "", steps: [{ id: "i", type: "implement" }, { id: "c", type: "close" }] },
    ]);
    await service.save("models", [
      { id: "normal", name: "Normal", base: "Normal", lifecycle: "", leadDays: 0, pir: "Never" },
    ]);
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({
      key: "models", value: [expect.objectContaining({ name: "Normal", lifecycle: "normal-lc" })],
    }));
  });

  it("persists newly added notification rules from the supported trigger catalog", async () => {
    const { service, repository } = makeService();
    await service.save("notifications", [{
      id: "e1", on: false, recipients: [], subject: "Change {{change.number}}", body: "Updated", format: "text",
    }]);
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({
      key: "notifications", value: [expect.objectContaining({ id: "e1", name: "Change submitted", subject: "Change {{change.number}}" })],
    }));
    await expect(service.save("notifications", [{
      id: "custom", on: false, recipients: [], subject: "Custom", body: "Updated", format: "text",
    }])).rejects.toThrow('Unknown change notification trigger "custom"');
  });

  it("validates and persists executable lifecycle actions", async () => {
    const { service, repository } = makeService();
    const steps = [
      { id: "wait", type: "wait", waitMinutes: 30 },
      { id: "email", type: "email", recipients: ["ops@example.com"], subject: "Change {{number}}", body: "Ready" },
      { id: "update", type: "update", updateField: "priority", updateValue: "P2 - High" },
      { id: "task", type: "task", taskName: "Verify rollout" },
      { id: "record", type: "record", recordType: "Change", recordTitle: "Follow-up" },
      { id: "integration", type: "integration", integrationUrl: "https://example.com/change-hook" },
      { id: "implement", type: "implement" },
      { id: "close", type: "close" },
    ];
    await service.save("lifecycles", [{ id: "actions", name: "Actions", desc: "", steps }]);
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ key: "lifecycles", value: [expect.objectContaining({
      steps: expect.arrayContaining([
        expect.objectContaining({ type: "wait", waitMinutes: 30 }),
        expect.objectContaining({ type: "email", recipients: ["ops@example.com"] }),
        expect.objectContaining({ type: "integration", integrationUrl: "https://example.com/change-hook" }),
      ]),
    })] }));
  });

  it("rejects invalid wait durations and non-HTTPS integrations", async () => {
    const { service } = makeService();
    await expect(service.save("lifecycles", [{
      id: "bad-wait", name: "Bad wait", desc: "", steps: [
        { id: "wait", type: "wait", waitMinutes: 0 }, { id: "implement", type: "implement" }, { id: "close", type: "close" },
      ],
    }])).rejects.toThrow("must wait between 1 and 525600 minutes");
    await expect(service.save("lifecycles", [{
      id: "bad-url", name: "Bad URL", desc: "", steps: [
        { id: "integration", type: "integration", integrationUrl: "http://example.com" },
        { id: "implement", type: "implement" }, { id: "close", type: "close" },
      ],
    }])).rejects.toThrow("needs an HTTPS URL");
  });
});
