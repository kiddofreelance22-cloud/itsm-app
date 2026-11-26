import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { EmailOutbox } from "./entities/email-outbox.entity";

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Thin wrapper around Nodemailer's SMTP transport, configured entirely from env vars
 * (see config/configuration.ts -> mail.*). Import MailModule wherever you need to send
 * email (e.g. AuthModule for password resets, UsersModule for welcome emails).
 * Requires: npm install nodemailer && npm install -D @types/nodemailer
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(
    private config: ConfigService,
    @InjectRepository(EmailOutbox) private outboxRepo: Repository<EmailOutbox>
  ) {}

  onModuleInit() {
    const host = this.config.get<string>("mail.host");
    const port = this.config.get<number>("mail.port");
    const secure = this.config.get<boolean>("mail.secure");
    const user = this.config.get<string>("mail.user");
    const password = this.config.get<string>("mail.password");

    if (!host || !user || !password) {
      this.logger.warn(
        "SMTP configuration is incomplete. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD (or SMTP_PASS) before sending mail."
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      auth: {
        user,
        pass: password,
      },
    });
  }

  /** Verifies SMTP credentials/connectivity. Call once at startup if you want a fast failure. */
  async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log("SMTP connection verified");
    } catch (err) {
      this.logger.error("SMTP connection failed", err instanceof Error ? err.stack : undefined);
      throw err;
    }
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const fromName = this.config.get<string>("mail.fromName");
    const fromAddress = this.config.get<string>("mail.fromAddress");

    try {
      await this.transporter.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      this.logger.log(`Email sent: "${options.subject}" -> ${options.to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email "${options.subject}" to ${Array.isArray(options.to) ? options.to.join(", ") : options.to}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }

  }

  async queue(options: { to: string | string[]; subject: string; html?: string }): Promise<void> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    if (!recipients.length) return;
    await this.outboxRepo.save(recipients.map((recipient) => this.outboxRepo.create({
      recipient,
      subject: options.subject,
      html: options.html ?? "",
    })));
  }

  /** First time login email with temporary password. */
  async sendFirstTimeLoginEmail(to: string, fullName: string, tempPassword: string, username: string): Promise<void> {
    await this.sendMail({
      to,
      subject: "Welcome to ITSM Portal – First Time Login",
      html: `
        <p>Hi ${fullName},</p>
        <p>Your ITSM Portal account has been created successfully.</p>
        <p>You can log in using the following credentials:</p>
        <p>Username: ${username}<br/>
        Temporary Password: ${tempPassword}</p>
        <p>For security reasons, you will be prompted to change your password after your first login. This temporary password can only be used once.</p>
        <p>Regards,<br/>ITSM Support</p>
      `,
    });
  }

  /** Example — wire into a future POST /auth/forgot-password flow. */
  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    await this.sendMail({
      to,
      subject: "Reset your ITSM Portal password",
      html: `
        <p>We received a request to reset your password.</p>
        <p><a href="${resetLink}">Click here to reset your password</a> (link expires in 1 hour).</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    });
  }

  /** Example — notify an approver when a request reaches their workflow step. */
  async sendApprovalRequestEmail(
    to: string,
    requestId: number,
    catalogName: string
  ): Promise<void> {
    await this.sendMail({
      to,
      subject: `Approval needed: Request #${requestId}`,
      html: `
        <p>A new request "<b>${catalogName}</b>" (#${requestId}) is waiting for your approval.</p>
        <p>Please log in to the ITSM Portal to review it.</p>
      `,
    });
  }
}
