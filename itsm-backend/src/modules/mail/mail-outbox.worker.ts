import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DataSource } from "typeorm";
import { MailService } from "./mail.service";

interface ClaimedEmail {
  id: number;
  recipient: string;
  subject: string;
  html: string;
  attempts: number;
}

@Injectable()
export class MailOutboxWorker {
  private readonly logger = new Logger(MailOutboxWorker.name);
  private running = false;

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private mail: MailService
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (let i = 0; i < 20; i++) {
        const result: unknown = await this.dataSource.query(`
          UPDATE email_outbox
             SET attempts = attempts + 1,
                 next_attempt_at = now() + interval '5 minutes'
           WHERE id = (
             SELECT id FROM email_outbox
              WHERE status = 'pending' AND next_attempt_at <= now()
              ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED
           )
           RETURNING id, recipient, subject, html, attempts
        `);
        const rows: ClaimedEmail[] = Array.isArray(result) && Array.isArray(result[0])
          ? result[0] as ClaimedEmail[]
          : result as ClaimedEmail[];
        const email = rows[0];
        if (!email) break;

        try {
          await this.mail.sendMail({ to: email.recipient, subject: email.subject, html: email.html });
        } catch (err) {
          const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
          await this.dataSource.query(`
            UPDATE email_outbox
               SET status = CASE WHEN $2 >= 5 THEN 'failed' ELSE 'pending' END,
                   last_error = $3,
                   next_attempt_at = CASE
                     WHEN $2 >= 5 THEN next_attempt_at
                     ELSE now() + ($2 * interval '2 minutes')
                   END
             WHERE id = $1
          `, [email.id, email.attempts, message]);
          this.logger.warn(`Email outbox item ${email.id} failed on attempt ${email.attempts}: ${message}`);
          continue;
        }
        await this.dataSource.query(
          `UPDATE email_outbox SET status = 'sent', last_error = NULL WHERE id = $1`,
          [email.id]
        );
      }
    } finally {
      this.running = false;
    }
  }
}
