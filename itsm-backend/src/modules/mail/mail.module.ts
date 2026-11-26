import { Module, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EmailOutbox } from "./entities/email-outbox.entity";
import { MailOutboxWorker } from "./mail-outbox.worker";
import { MailService } from "./mail.service";

/**
 * @Global so any module can inject MailService without re-importing MailModule everywhere.
 * Import once in AppModule's imports[] array.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([EmailOutbox])],
  providers: [MailService, MailOutboxWorker],
  exports: [MailService],
})
export class MailModule {}
