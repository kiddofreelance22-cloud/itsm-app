import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { CsmController } from "./csm.controller";
import { CsmService } from "./csm.service";

@Module({
  imports: [MailModule],
  controllers: [CsmController],
  providers: [CsmService],
  exports: [CsmService],
})
export class CsmModule {}
