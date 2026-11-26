import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { ServiceRequest } from "./entities/request.entity";
import { Catalog } from "../catalogs/entities/catalog.entity";
import { RequestPriorityMatrix } from "../request-masters/entities/request-priority-matrix.entity";
import { RequestSlaServiceWindow } from "../request-masters/entities/request-sla-service-window.entity";
import { ServicePriority } from "../service-priorities/entities/service-priority.entity";
import { addBusinessMinutes, businessMinutesBetween } from "../../common/utils/business-time.util";

export type SlaState = "not_started" | "on_track" | "at_risk" | "breached" | "paused" | "met";

@Injectable()
export class RequestSlaService {
  constructor(
    @InjectRepository(RequestPriorityMatrix) private matrixRepo: Repository<RequestPriorityMatrix>,
    @InjectRepository(RequestSlaServiceWindow) private windowRepo: Repository<RequestSlaServiceWindow>,
    @InjectRepository(ServicePriority) private priorityRepo: Repository<ServicePriority>,
    private config: ConfigService
  ) {}

  /** Priority for an urgency x SERVICE impact pair, from the request priority matrix. */
  async derivePriority(urgencyId?: number | null, serviceImpactId?: number | null): Promise<ServicePriority | null> {
    if (!urgencyId || !serviceImpactId) return null;
    const row = await this.matrixRepo.findOne({ where: { urgencyId, serviceImpactId, isActive: true } });
    return row?.priority ?? null;
  }

  /** The catalog item's service window (by SLA name), else the default window, else none (wall-clock). */
  async windowFor(slaName?: string | null): Promise<RequestSlaServiceWindow | null> {
    if (slaName) {
      const named = await this.windowRepo.findOne({ where: { slaName, isActive: true } });
      if (named) return named;
    }
    return this.windowRepo.findOne({ where: { isDefault: true, isActive: true } });
  }

  private days(win: RequestSlaServiceWindow | null) {
    return win && !win.is24x7 ? win.serviceWindow ?? [] : [];
  }

  private add(from: Date, minutes: number, win: RequestSlaServiceWindow | null): Date {
    return addBusinessMinutes(from, minutes, this.days(win), win?.timeZone);
  }

  /**
   * Starts the clock when a request reaches the agent queue. Priority resolution time is
   * the fulfilment target; catalog delivery days remain a fallback for priorities without one.
   */
  async startClock(request: ServiceRequest, catalog: Catalog, now = new Date()): Promise<void> {
    const win = await this.windowFor(catalog.slaName);
    request.slaServiceWindowId = win?.slaServiceWindowId ?? null;
    request.slaStartedAt = now;
    request.slaPausedAt = null;
    request.slaResponseMet = false;
    request.slaBreached = false;
    request.slaWarningSent = false;
    this.applyTargets(request, catalog.deliveryTimeSla, win, now);
  }

  private deliveryMinutes(deliveryDays: number, win: RequestSlaServiceWindow | null): number {
    const activeDays = this.days(win).filter((day) => day.enabled && day.to > day.from);
    const minutesPerDay = activeDays.length
      ? activeDays.reduce((total, day) => {
        const [fromHours, fromMinutes] = day.from.split(":").map(Number);
        const [toHours, toMinutes] = day.to.split(":").map(Number);
        return total + (toHours * 60 + toMinutes) - (fromHours * 60 + fromMinutes);
      }, 0) / activeDays.length
      : 24 * 60;
    return Math.round(deliveryDays * minutesPerDay);
  }

  private applyTargets(request: ServiceRequest, deliveryDays: number | null | undefined, win: RequestSlaServiceWindow | null, from: Date) {
    const resolutionMinutes = request.priority?.resolutionSlaMinutes;
    const fulfilmentMinutes = resolutionMinutes && resolutionMinutes > 0
      ? resolutionMinutes
      : deliveryDays && deliveryDays > 0
        ? this.deliveryMinutes(deliveryDays, win)
        : null;
    request.slaFulfilmentTarget = fulfilmentMinutes ? this.add(from, fulfilmentMinutes, win) : null;
    const respMin = request.priority?.responseSlaMinutes;
    request.slaResponseTarget = respMin && respMin > 0 ? this.add(from, respMin, win) : null;
  }

  /** Re-derives targets from the original start after the priority changed. */
  async recompute(request: ServiceRequest, catalog: Catalog): Promise<void> {
    if (!request.slaStartedAt) return;
    const win = request.slaServiceWindowId ? await this.windowRepo.findOne({ where: { slaServiceWindowId: request.slaServiceWindowId } }) : null;
    const from = request.slaStartedAt;
    const respMet = request.slaResponseMet;
    const prevResp = request.slaResponseTarget;
    this.applyTargets(request, catalog.deliveryTimeSla, win, from);
    if (respMet) request.slaResponseTarget = prevResp ?? request.slaResponseTarget;
  }

  /** Pause: remember when. Resume: push open targets out by the working time left at the pause. */
  pause(request: ServiceRequest, now = new Date()): void {
    if (!request.slaPausedAt && request.slaStartedAt) request.slaPausedAt = now;
  }
  async resume(request: ServiceRequest, now = new Date()): Promise<void> {
    if (!request.slaPausedAt) return;
    const win = request.slaServiceWindowId ? await this.windowRepo.findOne({ where: { slaServiceWindowId: request.slaServiceWindowId } }) : null;
    const paused = request.slaPausedAt;
    const shift = (target?: Date | null) => {
      if (!target) return target ?? null;
      const left = businessMinutesBetween(paused, target, this.days(win), win?.timeZone);
      return target.getTime() <= paused.getTime() ? target : this.add(now, left, win);
    };
    request.slaFulfilmentTarget = shift(request.slaFulfilmentTarget);
    if (!request.slaResponseMet) request.slaResponseTarget = shift(request.slaResponseTarget);
    request.slaPausedAt = null;
  }

  /** N business days (Mon-Fri) after `from`, N from REQUEST_AUTO_CLOSE_BUSINESS_DAYS (default 3). */
  autoCloseDate(from: Date): Date {
    const n = Number(this.config.get("REQUEST_AUTO_CLOSE_BUSINESS_DAYS") ?? process.env.REQUEST_AUTO_CLOSE_BUSINESS_DAYS ?? 3) || 3;
    const d = new Date(from);
    let left = n;
    while (left > 0) {
      d.setUTCDate(d.getUTCDate() + 1);
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) left--;
    }
    return d;
  }

  /** What the SLA looks like right now, for lists and the record. */
  state(request: ServiceRequest, now = new Date()): SlaState {
    if (!request.slaStartedAt) return "not_started";
    if (["Fulfilled", "Closed"].includes(request.status)) return request.slaBreached ? "breached" : "met";
    if (["Rejected", "Cancelled"].includes(request.status)) return "not_started";
    if (request.slaBreached) return "breached";
    if (request.slaPausedAt) return "paused";
    const target = request.slaFulfilmentTarget;
    if (!target) return "on_track";
    if (target.getTime() < now.getTime()) return "breached";
    const total = target.getTime() - request.slaStartedAt.getTime();
    const window = Math.min(60 * 60 * 1000, total * 0.2);
    return target.getTime() - now.getTime() <= window ? "at_risk" : "on_track";
  }
}
