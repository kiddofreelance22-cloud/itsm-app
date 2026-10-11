import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ServiceImpact } from "./entities/service-impact.entity";
import { ServiceImpactsController } from "./service-impacts.controller";
import { ServiceImpactsService } from "./service-impacts.service";

@Module({
  imports: [TypeOrmModule.forFeature([ServiceImpact])],
  controllers: [ServiceImpactsController],
  providers: [ServiceImpactsService],
  exports: [ServiceImpactsService],
})
export class ServiceImpactsModule {}