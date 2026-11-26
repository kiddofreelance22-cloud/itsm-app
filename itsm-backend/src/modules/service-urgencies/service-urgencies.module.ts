import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ServiceUrgency } from "./entities/service-urgency.entity";
import { ServiceUrgenciesController } from "./service-urgencies.controller";
import { ServiceUrgenciesService } from "./service-urgencies.service";

@Module({
  imports: [TypeOrmModule.forFeature([ServiceUrgency])],
  controllers: [ServiceUrgenciesController],
  providers: [ServiceUrgenciesService],
  exports: [ServiceUrgenciesService, TypeOrmModule],
})
export class ServiceUrgenciesModule {}
