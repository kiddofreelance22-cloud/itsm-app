import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IncidentFieldVisibility } from "./entities/incident-field-visibility.entity";
import { IncidentConfigController } from "./incident-config.controller";
import { IncidentConfigService } from "./incident-config.service";

@Module({
  imports: [TypeOrmModule.forFeature([IncidentFieldVisibility])],
  controllers: [IncidentConfigController],
  providers: [IncidentConfigService],
})
export class IncidentConfigModule {}