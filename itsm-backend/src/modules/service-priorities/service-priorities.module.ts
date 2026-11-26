import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ServicePriority } from "./entities/service-priority.entity";
import { ServicePrioritiesController } from "./service-priorities.controller";
import { ServicePrioritiesService } from "./service-priorities.service";

@Module({
  imports: [TypeOrmModule.forFeature([ServicePriority])],
  controllers: [ServicePrioritiesController],
  providers: [ServicePrioritiesService],
  exports: [ServicePrioritiesService],
})
export class ServicePrioritiesModule {}
