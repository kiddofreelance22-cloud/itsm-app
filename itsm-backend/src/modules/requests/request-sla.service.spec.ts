import type { ConfigService } from "@nestjs/config";
import type { Repository } from "typeorm";
import { Catalog } from "../catalogs/entities/catalog.entity";
import { RequestPriorityMatrix } from "../request-masters/entities/request-priority-matrix.entity";
import { RequestSlaServiceWindow } from "../request-masters/entities/request-sla-service-window.entity";
import { ServiceRequest } from "./entities/request.entity";
import { RequestSlaService } from "./request-sla.service";
import { ServicePriority } from "../service-priorities/entities/service-priority.entity";

describe("RequestSlaService", () => {
  it("uses the priority resolution SLA for the fulfilment target", async () => {
    const windowRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new RequestSlaService(
      {} as Repository<RequestPriorityMatrix>,
      windowRepo as unknown as Repository<RequestSlaServiceWindow>,
      {} as Repository<ServicePriority>,
      {} as ConfigService,
    );
    const startedAt = new Date("2026-10-28T03:00:00.000Z");
    const request = {
      priority: { responseSlaMinutes: 10, resolutionSlaMinutes: 15 },
    } as ServiceRequest;
    const catalog = { deliveryTimeSla: 4 } as Catalog;

    await service.startClock(request, catalog, startedAt);

    expect(request.slaResponseTarget?.getTime()).toBe(startedAt.getTime() + 10 * 60_000);
    expect(request.slaFulfilmentTarget?.getTime()).toBe(startedAt.getTime() + 15 * 60_000);
  });

  it("recalculates an existing fulfilment target when priority SLA is now available", async () => {
    const windowRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new RequestSlaService(
      {} as Repository<RequestPriorityMatrix>,
      windowRepo as unknown as Repository<RequestSlaServiceWindow>,
      {} as Repository<ServicePriority>,
      {} as ConfigService,
    );
    const startedAt = new Date("2026-10-28T03:00:00.000Z");
    const request = {
      slaStartedAt: startedAt,
      priority: { responseSlaMinutes: 10, resolutionSlaMinutes: 15 },
      slaFulfilmentTarget: new Date(startedAt.getTime() + 4 * 60 * 60_000),
    } as ServiceRequest;
    const catalog = { deliveryTimeSla: 4 } as Catalog;

    await service.recompute(request, catalog);

    expect(request.slaFulfilmentTarget?.getTime()).toBe(startedAt.getTime() + 15 * 60_000);
  });

  it("treats the catalog fallback as days when priority resolution is not configured", async () => {
    const windowRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new RequestSlaService(
      {} as Repository<RequestPriorityMatrix>,
      windowRepo as unknown as Repository<RequestSlaServiceWindow>,
      {} as Repository<ServicePriority>,
      {} as ConfigService,
    );
    const startedAt = new Date("2026-10-28T03:00:00.000Z");
    const request = {} as ServiceRequest;
    const catalog = { deliveryTimeSla: 4 } as Catalog;

    await service.startClock(request, catalog, startedAt);

    expect(request.slaFulfilmentTarget?.getTime()).toBe(startedAt.getTime() + 4 * 24 * 60 * 60_000);
  });
});
