import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Urgency } from "./entities/urgency.entity";
import { UrgencyService } from "./urgency.service";
import { UrgencyController } from "./urgency.controller";
@Module({
  imports: [TypeOrmModule.forFeature([Urgency])],
  controllers: [UrgencyController],
  providers: [UrgencyService],
  exports: [UrgencyService],
})
export class UrgencyModule {}
