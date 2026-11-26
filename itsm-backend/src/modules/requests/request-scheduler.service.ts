import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { RequestsService } from "./requests.service";

/** Every minute: flag SLA breaches / warnings, and auto-close Fulfilled requests nobody confirmed. */
@Injectable()
export class RequestSchedulerService {
  private readonly logger = new Logger(RequestSchedulerService.name);
  private running = false;

  constructor(private requests: RequestsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      // Each job runs on its own: one that fails (a mail server down while auto-closing, say) must never stop the
      // others, least of all the one that ends Wait steps.
      const days = Number(process.env.REQUEST_AUTO_CLOSE_BUSINESS_DAYS ?? 3) || 3;
      const job = async <T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
        try { return await fn(); } catch (err) {
          this.logger.error(`Request sweep (${name}) failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
          return fallback;
        }
      };
      const waits = await job("waits", () => this.requests.releaseDueWaits(), 0);
      const timers = await job("approval timers", () => this.requests.sweepApprovalTimers(), { reminded: 0, timedOut: 0 });
      const closed = await job("auto-close", async () => {
        const due = await this.requests.findDueForAutoClose();
        let n = 0;
        for (const r of due) {
          try { await this.requests.autoClose(r.requestId, days); n++; } catch (err) {
            this.logger.error(`Auto-closing request ${r.requestId} failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        return n;
      }, 0);
      const sla = await job("sla", () => this.requests.sweepSla(), { breached: 0, warned: 0 });
      if (waits || closed || sla.breached || sla.warned || timers.reminded || timers.timedOut) {
        this.logger.log(`Request sweep: waits ended ${waits}, auto-closed ${closed}, breached ${sla.breached}, warned ${sla.warned}, approval reminders ${timers.reminded}, approval timeouts ${timers.timedOut}`);
      }
    } finally {
      this.running = false;
    }
  }
}
